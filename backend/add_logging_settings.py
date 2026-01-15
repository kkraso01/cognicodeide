"""
Database migration script to add logging_settings columns.
Run this script to update the database schema.
"""
import asyncio
import aiosqlite
from pathlib import Path

DATABASE_PATH = Path(__file__).parent / "cognicode.db"


async def migrate():
    """Add logging_settings columns to users and assignments tables."""
    print("Starting database migration...")
    
    async with aiosqlite.connect(DATABASE_PATH) as db:
        # Check if columns already exist
        cursor = await db.execute("PRAGMA table_info(users)")
        user_columns = await cursor.fetchall()
        user_column_names = [col[1] for col in user_columns]
        
        cursor = await db.execute("PRAGMA table_info(assignments)")
        assignment_columns = await cursor.fetchall()
        assignment_column_names = [col[1] for col in assignment_columns]
        
        # Add logging_settings to users table if it doesn't exist
        if 'logging_settings' not in user_column_names:
            print("Adding logging_settings column to users table...")
            await db.execute("""
                ALTER TABLE users 
                ADD COLUMN logging_settings TEXT
            """)
            print(" Added logging_settings to users table")
        else:
            print(" logging_settings column already exists in users table")
        
        # Add logging_settings to assignments table if it doesn't exist
        if 'logging_settings' not in assignment_column_names:
            print("Adding logging_settings column to assignments table...")
            await db.execute("""
                ALTER TABLE assignments 
                ADD COLUMN logging_settings TEXT
            """)
            print(" Added logging_settings to assignments table")
        else:
            print(" logging_settings column already exists in assignments table")
        
        await db.commit()
        print("\nMigration completed successfully! ")
        print("\nNote: SQLite stores JSON as TEXT. The backend will handle JSON serialization.")


if __name__ == "__main__":
    asyncio.run(migrate())
