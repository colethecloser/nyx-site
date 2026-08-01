"""Thin Postgres persistence layer for saved LBO scenarios."""

import json
import os
import uuid
from typing import Any, Optional

import psycopg
from psycopg.rows import dict_row

DEFAULT_DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/lbo_model_builder"


def get_database_url() -> str:
    return os.environ.get("DATABASE_URL", DEFAULT_DATABASE_URL)


def get_connection():
    return psycopg.connect(get_database_url(), row_factory=dict_row, autocommit=True)


def insert_scenario(name: str, inputs: dict, outputs: dict) -> dict:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO scenarios (name, inputs, outputs)
                VALUES (%s, %s, %s)
                RETURNING id, name, inputs, outputs, created_at
                """,
                (name, json.dumps(inputs), json.dumps(outputs)),
            )
            return cur.fetchone()


def list_scenarios() -> list:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, name, created_at,
                       outputs->'summary'->>'irr' AS irr,
                       outputs->'summary'->>'moic' AS moic
                FROM scenarios
                ORDER BY created_at DESC
                """
            )
            return cur.fetchall()


def get_scenario(scenario_id: str) -> Optional[dict]:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, name, inputs, outputs, created_at FROM scenarios WHERE id = %s",
                (scenario_id,),
            )
            return cur.fetchone()


def delete_scenario(scenario_id: str) -> bool:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM scenarios WHERE id = %s", (scenario_id,))
            return cur.rowcount > 0
