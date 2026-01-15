"""
Script to create test users in the database.
Run this after recreating the database.
"""
import asyncio
from app.database import get_db, engine, Base
from app.models.models import User, UserRole
from app.auth_utils import get_password_hash
from sqlalchemy.ext.asyncio import AsyncSession


async def create_test_users():
    """Create test teacher and student users."""
    # Create tables if they don't exist
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    async for db in get_db():
        # Create teacher
        teacher = User(
            username="kkraso01prof",
            email="teacher@cognicode.com",
            password_hash=get_password_hash("password123"),
            role=UserRole.TEACHER
        )
        db.add(teacher)
        
        # Create student
        student = User(
            username="kkraso01",
            email="student@cognicode.com",
            password_hash=get_password_hash("password123"),
            role=UserRole.STUDENT
        )
        db.add(student)
        
        await db.commit()
        print(" Test users created successfully!")
        print("\nTeacher account:")
        print("  Username: kkraso01prof")
        print("  Password: password123")
        print("\nStudent account:")
        print("  Username: kkraso01")
        print("  Password: password123")
        break


if __name__ == "__main__":
    asyncio.run(create_test_users())
