"""数据库模型定义"""
import uuid
from datetime import datetime
from sqlalchemy import String, Text, JSON, Integer, Float, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.core.database import Base


def gen_uuid() -> str:
    return str(uuid.uuid4())


class ResumeSession(Base):
    """简历处理会话"""
    __tablename__ = "resume_sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    status: Mapped[str] = mapped_column(String(20), default="created")  # created/parsing/parsed/generating/completed
    source_filename: Mapped[str] = mapped_column(String(255))
    source_format: Mapped[str] = mapped_column(String(10))  # pdf/docx/txt
    source_path: Mapped[str] = mapped_column(String(500))

    # 关联
    profile: Mapped["ResumeProfile"] = relationship(back_populates="session", uselist=False)
    versions: Mapped[list["ResumeVersion"]] = relationship(back_populates="session")
    jd_inputs: Mapped[list["JDInput"]] = relationship(back_populates="session")


class ResumeProfile(Base):
    """结构化简历数据"""
    __tablename__ = "resume_profiles"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    session_id: Mapped[str] = mapped_column(String(36), ForeignKey("resume_sessions.id"))
    data: Mapped[dict] = mapped_column(JSON, comment="符合resume_profile.json schema的结构化数据")
    extraction_confidence: Mapped[float] = mapped_column(Float, default=0.0)
    missing_fields: Mapped[list] = mapped_column(JSON, default=list)
    open_questions: Mapped[list] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    confirmed: Mapped[bool] = mapped_column(Boolean, default=False)

    session: Mapped["ResumeSession"] = relationship(back_populates="profile")


class JDInput(Base):
    """岗位描述输入"""
    __tablename__ = "jd_inputs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    session_id: Mapped[str] = mapped_column(String(36), ForeignKey("resume_sessions.id"))
    job_title: Mapped[str] = mapped_column(String(200))
    company: Mapped[str | None] = mapped_column(String(200), nullable=True)
    jd_text: Mapped[str] = mapped_column(Text)
    keywords: Mapped[list] = mapped_column(JSON, default=list)
    seniority: Mapped[str | None] = mapped_column(String(50), nullable=True)
    industry: Mapped[str | None] = mapped_column(String(100), nullable=True)
    language: Mapped[str] = mapped_column(String(10), default="zh-CN")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    session: Mapped["ResumeSession"] = relationship(back_populates="jd_inputs")


class ResumeVersion(Base):
    """简历版本"""
    __tablename__ = "resume_versions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    session_id: Mapped[str] = mapped_column(String(36), ForeignKey("resume_sessions.id"))
    jd_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("jd_inputs.id"), nullable=True)
    version_number: Mapped[int] = mapped_column(Integer)
    version_type: Mapped[str] = mapped_column(String(30))  # ats_friendly/concise/enhanced/bilingual/styled
    template_id: Mapped[str | None] = mapped_column(String(20), nullable=True)  # A/B/C/D/E
    content_md: Mapped[str] = mapped_column(Text, comment="Markdown格式简历内容")
    content_html: Mapped[str | None] = mapped_column(Text, nullable=True)
    scorecard: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    diff_from_previous: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    session: Mapped["ResumeSession"] = relationship(back_populates="versions")


class FeedbackLog(Base):
    """用户反馈日志（append-only）"""
    __tablename__ = "feedback_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    session_id: Mapped[str] = mapped_column(String(36), ForeignKey("resume_sessions.id"))
    version_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    feedback_type: Mapped[str] = mapped_column(String(30))  # accept/reject/edit/comment
    content: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
