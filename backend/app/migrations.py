import bcrypt
from sqlalchemy import inspect, select, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from .config import get_settings
from .database import Base
from .identity import generate_ojatag
from .models import AdminUser


def ensure_ojatag_schema(engine: Engine) -> None:
    """
    Add and backfill OjaTag, PIN brute-force protection, security-question
    PIN recovery, support ticket replies, user notifications, and seed the
    system AdminUser from environment variables without deleting existing data.
    """
    Base.metadata.create_all(bind=engine)

    inspector = inspect(engine)
    table_names = set(inspector.get_table_names())

    if "users" not in table_names:
        return

    columns = {column["name"] for column in inspector.get_columns("users")}
    ticket_columns = (
        {column["name"] for column in inspector.get_columns("support_tickets")}
        if "support_tickets" in table_names
        else set()
    )

    with engine.begin() as connection:
        if "oja_tag" not in columns:
            connection.execute(text("ALTER TABLE users ADD COLUMN oja_tag VARCHAR(20)"))

        if "security_question" not in columns:
            connection.execute(
                text("ALTER TABLE users ADD COLUMN security_question VARCHAR(255)")
            )

        if "security_answer_hash" not in columns:
            connection.execute(
                text("ALTER TABLE users ADD COLUMN security_answer_hash TEXT")
            )

        if "failed_pin_attempts" not in columns:
            connection.execute(
                text(
                    "ALTER TABLE users ADD COLUMN failed_pin_attempts INTEGER NOT NULL DEFAULT 0"
                )
            )

        if "locked_until_epoch" not in columns:
            connection.execute(
                text("ALTER TABLE users ADD COLUMN locked_until_epoch INTEGER")
            )

        if "failed_recovery_attempts" not in columns:
            connection.execute(
                text(
                    "ALTER TABLE users ADD COLUMN failed_recovery_attempts INTEGER NOT NULL DEFAULT 0"
                )
            )

        if "recovery_locked_until_epoch" not in columns:
            connection.execute(
                text("ALTER TABLE users ADD COLUMN recovery_locked_until_epoch INTEGER")
            )

        existing = {
            row[0]
            for row in connection.execute(
                text(
                    "SELECT oja_tag "
                    "FROM users "
                    "WHERE oja_tag IS NOT NULL "
                    "AND oja_tag <> ''"
                )
            )
        }

        missing_users = connection.execute(
            text("SELECT id FROM users WHERE oja_tag IS NULL OR oja_tag = ''")
        ).fetchall()

        for row in missing_users:
            tag = generate_ojatag()

            while tag in existing:
                tag = generate_ojatag()

            connection.execute(
                text("UPDATE users SET oja_tag = :tag WHERE id = :user_id"),
                {
                    "tag": tag,
                    "user_id": row[0],
                },
            )

            existing.add(tag)

        connection.execute(
            text(
                "CREATE UNIQUE INDEX IF NOT EXISTS ix_users_oja_tag ON users (oja_tag)"
            )
        )

        if "support_tickets" in table_names:
            if "admin_reply" not in ticket_columns:
                connection.execute(
                    text("ALTER TABLE support_tickets ADD COLUMN admin_reply TEXT")
                )
            if "replied_by" not in ticket_columns:
                connection.execute(
                    text(
                        "ALTER TABLE support_tickets ADD COLUMN replied_by VARCHAR(120)"
                    )
                )
            if "replied_at" not in ticket_columns:
                connection.execute(
                    text("ALTER TABLE support_tickets ADD COLUMN replied_at TIMESTAMP")
                )

    _seed_system_admin(engine)


def _seed_system_admin(engine: Engine) -> None:
    """
    Ensure the dedicated system administrator account configured via
    ADMIN_EMAIL and ADMIN_PASSWORD exists in `admin_users` with role='admin'.
    """
    settings = get_settings()
    admin_email = (settings.admin_email or "").strip().lower()
    admin_password = (settings.admin_password or "").strip()
    if not admin_email or not admin_password:
        return

    with Session(bind=engine) as session:
        # Deactivate any stale admin rows that do not match the configured ADMIN_EMAIL
        stale_admins = session.scalars(
            select(AdminUser).where(AdminUser.email != admin_email)
        ).all()
        for stale in stale_admins:
            if stale.is_active:
                stale.is_active = False

        existing_admin = session.scalar(
            select(AdminUser).where(AdminUser.email == admin_email)
        )
        raw_pw = admin_password.encode("utf-8")[:72]
        if existing_admin is None:
            pw_hash = bcrypt.hashpw(raw_pw, bcrypt.gensalt(rounds=12)).decode("utf-8")
            session.add(
                AdminUser(
                    email=admin_email,
                    role="admin",
                    password_hash=pw_hash,
                    is_active=True,
                )
            )
            session.commit()
        else:
            changed = bool(stale_admins)
            if not existing_admin.is_active:
                existing_admin.is_active = True
                changed = True
            if existing_admin.role != "admin":
                existing_admin.role = "admin"
                changed = True
            if not existing_admin.password_hash or not bcrypt.checkpw(
                raw_pw, existing_admin.password_hash.encode("utf-8")
            ):
                existing_admin.password_hash = bcrypt.hashpw(
                    raw_pw, bcrypt.gensalt(rounds=12)
                ).decode("utf-8")
                changed = True
            if changed:
                session.commit()
