from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine

from .identity import generate_ojatag


def ensure_ojatag_schema(engine: Engine) -> None:
    """
    Add and backfill the OjaTag column
    without deleting or replacing existing
    OjaFlow user/business data.
    """

    inspector = inspect(engine)

    if "users" not in inspector.get_table_names():
        return

    columns = {column["name"] for column in inspector.get_columns("users")}

    with engine.begin() as connection:
        if "oja_tag" not in columns:
            connection.execute(text("ALTER TABLE users ADD COLUMN oja_tag VARCHAR(20)"))

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
