from datetime import datetime
from sqlalchemy import (
    BigInteger,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ...database import Base
from ...models import now_utc, uuid_str


class ProofBusiness(Base):
    __tablename__ = "proof_businesses"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=uuid_str,
    )
    owner_user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        index=True,
        nullable=False,
    )
    name: Mapped[str] = mapped_column(
        String(160),
        default="My Business",
        nullable=False,
    )
    phone: Mapped[str] = mapped_column(
        String(20),
        default="",
        nullable=False,
    )
    email: Mapped[str] = mapped_column(
        String(160),
        default="",
        nullable=False,
    )
    address: Mapped[str] = mapped_column(
        String(255),
        default="",
        nullable=False,
    )
    logo_data: Mapped[str | None] = mapped_column(
        Text,
        default="",
        nullable=True,
    )
    receipt_prefix: Mapped[str] = mapped_column(
        String(6),
        default="OP",
        nullable=False,
    )
    next_seq: Mapped[int] = mapped_column(
        Integer,
        default=1,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=now_utc,
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=now_utc,
        onupdate=now_utc,
        nullable=False,
    )

    customers: Mapped[list["ProofCustomer"]] = relationship(
        back_populates="business",
        cascade="all, delete-orphan",
    )
    receipts: Mapped[list["ProofReceipt"]] = relationship(
        back_populates="business",
        cascade="all, delete-orphan",
    )


class ProofCustomer(Base):
    __tablename__ = "proof_customers"
    __table_args__ = (
        UniqueConstraint(
            "business_id",
            "phone",
            name="uq_proof_customers_business_phone",
        ),
    )

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=uuid_str,
    )
    business_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("proof_businesses.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    name: Mapped[str] = mapped_column(
        String(120),
        nullable=False,
    )
    phone: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True,
    )
    email: Mapped[str | None] = mapped_column(
        String(160),
        default="",
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=now_utc,
        nullable=False,
    )

    business: Mapped[ProofBusiness] = relationship(back_populates="customers")


class ProofReceipt(Base):
    __tablename__ = "proof_receipts"
    __table_args__ = (
        UniqueConstraint(
            "business_id",
            "number",
            name="uq_proof_receipts_business_number",
        ),
        Index(
            "ix_proof_receipts_business_issued_at",
            "business_id",
            "issued_at",
        ),
        Index(
            "ix_proof_receipts_business_status",
            "business_id",
            "status",
        ),
        Index(
            "ix_proof_receipts_public_code",
            "public_code",
            unique=True,
        ),
    )

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
    )
    business_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("proof_businesses.id", ondelete="CASCADE"),
        nullable=False,
    )
    number: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
    )
    public_code: Mapped[str] = mapped_column(
        String(8),
        unique=True,
        nullable=False,
    )
    record_type: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
    )
    customer_name: Mapped[str] = mapped_column(
        String(120),
        nullable=False,
    )
    customer_phone: Mapped[str] = mapped_column(
        String(20),
        default="",
        nullable=False,
    )
    customer_email: Mapped[str] = mapped_column(
        String(160),
        default="",
        nullable=False,
    )
    currency: Mapped[str] = mapped_column(
        String(10),
        default="NGN",
        nullable=False,
    )
    subtotal_kobo: Mapped[int] = mapped_column(
        BigInteger,
        nullable=False,
    )
    discount_kobo: Mapped[int] = mapped_column(
        BigInteger,
        default=0,
        nullable=False,
    )
    total_kobo: Mapped[int] = mapped_column(
        BigInteger,
        nullable=False,
    )
    amount_paid_kobo: Mapped[int] = mapped_column(
        BigInteger,
        default=0,
        nullable=False,
    )
    payment_method: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
    )
    notes: Mapped[str] = mapped_column(
        Text,
        default="",
        nullable=False,
    )
    issued_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )
    status: Mapped[str] = mapped_column(
        String(20),
        default="valid",
        nullable=False,
    )
    void_reason: Mapped[str | None] = mapped_column(
        String(300),
        nullable=True,
    )
    voided_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    content_hash: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=now_utc,
        nullable=False,
    )
    synced_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=now_utc,
        nullable=False,
    )

    business: Mapped[ProofBusiness] = relationship(back_populates="receipts")
    items: Mapped[list["ProofReceiptItem"]] = relationship(
        back_populates="receipt",
        cascade="all, delete-orphan",
        order_by="ProofReceiptItem.position",
    )
    deliveries: Mapped[list["ProofDelivery"]] = relationship(
        back_populates="receipt",
        cascade="all, delete-orphan",
        order_by="ProofDelivery.created_at",
    )


class ProofReceiptItem(Base):
    __tablename__ = "proof_receipt_items"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=uuid_str,
    )
    receipt_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("proof_receipts.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    position: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )
    description: Mapped[str] = mapped_column(
        String(200),
        nullable=False,
    )
    serial_number: Mapped[str] = mapped_column(
        String(100),
        default="",
        nullable=False,
    )
    quantity: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )
    unit_price_kobo: Mapped[int] = mapped_column(
        BigInteger,
        nullable=False,
    )
    line_total_kobo: Mapped[int] = mapped_column(
        BigInteger,
        nullable=False,
    )

    receipt: Mapped[ProofReceipt] = relationship(back_populates="items")


class ProofDelivery(Base):
    __tablename__ = "proof_deliveries"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=uuid_str,
    )
    receipt_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("proof_receipts.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    channel: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=now_utc,
        nullable=False,
    )

    receipt: Mapped[ProofReceipt] = relationship(back_populates="deliveries")


class ProofAuditLog(Base):
    __tablename__ = "proof_audit_log"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=uuid_str,
    )
    business_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("proof_businesses.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    action: Mapped[str] = mapped_column(
        String(60),
        nullable=False,
    )
    receipt_id: Mapped[str | None] = mapped_column(
        String(36),
        index=True,
        nullable=True,
    )
    detail: Mapped[str] = mapped_column(
        String(500),
        default="",
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=now_utc,
        nullable=False,
    )
