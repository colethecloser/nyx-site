"""Database connection helper."""
import os
import psycopg2
import psycopg2.extras

DATABASE_URL = os.environ.get(
    "DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/comparable_transactions"
)


def get_connection():
    """Return a new psycopg2 connection with dict-like row access."""
    conn = psycopg2.connect(DATABASE_URL)
    return conn


def dict_cursor(conn):
    return conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
