"""
Database migration script to add performance indexes and file_path column.

This script adds:
1. file_path column to events table (for multi-file support)
2. Performance indexes for 10-100 faster queries
3. Backwards compatible - safe to run on existing database

Run with: python migrate_add_indexes.py
"""

import sqlite3
import os
from pathlib import Path

DB_PATH = Path(__file__).parent / "cognicode.db"

def migrate_database():
    """Add indexes and file_path column to existing database."""
    
    if not DB_PATH.exists():
        print(f" Database not found at {DB_PATH}")
        print("   Create database first by running the application")
        return False
    
    print(f" Migrating database: {DB_PATH}")
    print()
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        # Check if file_path column exists
        cursor.execute("PRAGMA table_info(events)")
        columns = [row[1] for row in cursor.fetchall()]
        
        if 'file_path' not in columns:
            print(" Adding file_path column to events table...")
            cursor.execute("""
                ALTER TABLE events 
                ADD COLUMN file_path VARCHAR(500)
            """)
            print("    file_path column added")
        else:
            print("     file_path column already exists")
        
        # Get existing indexes
        cursor.execute("""
            SELECT name FROM sqlite_master 
            WHERE type='index' AND tbl_name='events'
        """)
        existing_indexes = {row[0] for row in cursor.fetchall()}
        
        # Define indexes to create
        indexes_to_create = [
            {
                'name': 'idx_events_attempt_seq',
                'sql': 'CREATE INDEX IF NOT EXISTS idx_events_attempt_seq ON events(attempt_id, seq)',
                'description': 'Fast replay queries (attempt_id + seq)'
            },
            {
                'name': 'idx_events_attempt_time',
                'sql': 'CREATE INDEX IF NOT EXISTS idx_events_attempt_time ON events(attempt_id, t)',
                'description': 'Time-based queries (attempt_id + timestamp)'
            },
            {
                'name': 'idx_events_type',
                'sql': 'CREATE INDEX IF NOT EXISTS idx_events_type ON events(type)',
                'description': 'Event type filtering'
            },
            {
                'name': 'idx_events_file',
                'sql': 'CREATE INDEX IF NOT EXISTS idx_events_file ON events(file_path)',
                'description': 'Multi-file project queries'
            }
        ]
        
        print()
        print(" Creating performance indexes...")
        
        created_count = 0
        for idx in indexes_to_create:
            if idx['name'] in existing_indexes:
                print(f"     {idx['name']} already exists")
            else:
                print(f"    Creating {idx['name']}: {idx['description']}")
                cursor.execute(idx['sql'])
                created_count += 1
                print(f"    {idx['name']} created")
        
        # Commit all changes
        conn.commit()
        
        # Get database stats
        cursor.execute("SELECT COUNT(*) FROM events")
        event_count = cursor.fetchone()[0]
        
        print()
        print("=" * 60)
        print(" Migration completed successfully!")
        print("=" * 60)
        print(f"   Database: {DB_PATH}")
        print(f"   Events in database: {event_count:,}")
        print(f"   Indexes created: {created_count}")
        print()
        print(" Expected Performance Improvements:")
        print("   - Replay queries: 10-100 faster")
        print("   - Event filtering: 10-50 faster")
        print("   - Teacher dashboard: Much snappier")
        print()
        print(" Verify indexes with:")
        print("   sqlite3 cognicode.db")
        print("   > .indices events")
        print()
        
        return True
        
    except Exception as e:
        conn.rollback()
        print()
        print(f" Migration failed: {e}")
        print()
        print(" Troubleshooting:")
        print("   1. Make sure no other processes are using the database")
        print("   2. Check database file permissions")
        print("   3. Backup database before retrying")
        return False
        
    finally:
        conn.close()


def verify_indexes():
    """Verify that indexes were created successfully."""
    
    if not DB_PATH.exists():
        return
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        cursor.execute("""
            SELECT name, sql FROM sqlite_master 
            WHERE type='index' AND tbl_name='events'
            AND name LIKE 'idx_events_%'
            ORDER BY name
        """)
        
        indexes = cursor.fetchall()
        
        if indexes:
            print(" Current indexes on events table:")
            for name, sql in indexes:
                print(f"    {name}")
        else:
            print("  No custom indexes found on events table")
            
    finally:
        conn.close()


def show_query_plan():
    """Show query execution plan to verify index usage."""
    
    if not DB_PATH.exists():
        return
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        # Check if we have any data
        cursor.execute("SELECT COUNT(*) FROM events")
        event_count = cursor.fetchone()[0]
        
        if event_count == 0:
            print("  No events in database yet. Indexes will be used once data is added.")
            return
        
        print()
        print(" Query Execution Plans (verify index usage):")
        print()
        
        # Test query 1: Replay query
        print("1  Replay query (SELECT * FROM events WHERE attempt_id = 1 ORDER BY seq):")
        cursor.execute("EXPLAIN QUERY PLAN SELECT * FROM events WHERE attempt_id = 1 ORDER BY seq")
        plan = cursor.fetchall()
        for row in plan:
            print(f"   {row}")
            if 'idx_events_attempt_seq' in str(row):
                print("    Using idx_events_attempt_seq index (FAST!)")
        
        print()
        
        # Test query 2: Type filter
        print("2  Type filter (SELECT * FROM events WHERE type = 'paste'):")
        cursor.execute("EXPLAIN QUERY PLAN SELECT * FROM events WHERE type = 'paste'")
        plan = cursor.fetchall()
        for row in plan:
            print(f"   {row}")
            if 'idx_events_type' in str(row):
                print("    Using idx_events_type index (FAST!)")
        
    finally:
        conn.close()


if __name__ == '__main__':
    print()
    print("=" * 60)
    print("  COGNICODE Database Migration: Performance Indexes")
    print("=" * 60)
    print()
    
    success = migrate_database()
    
    if success:
        print()
        verify_indexes()
        
        print()
        show_query_plan()
    
    print()
    print("=" * 60)

