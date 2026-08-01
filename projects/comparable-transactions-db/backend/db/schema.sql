-- Comparable Transactions Database schema
-- All figures stored in this table are ILLUSTRATIVE / APPROXIMATE and intended
-- for a portfolio demo only. See README.md and each row's source_notes.

DROP TABLE IF EXISTS transactions;

CREATE TABLE transactions (
    id                          SERIAL PRIMARY KEY,
    target_name                 TEXT NOT NULL,
    sector                      TEXT NOT NULL,
    announced_date               DATE NOT NULL,
    closed_date                  DATE,
    acquirer_sponsor              TEXT NOT NULL,
    deal_type                    TEXT NOT NULL CHECK (
        deal_type IN ('going_private', 'carve_out', 'secondary_buyout', 'growth_buyout')
    ),
    enterprise_value_musd         NUMERIC(12, 1) NOT NULL,
    ltm_revenue_musd              NUMERIC(12, 1),
    ltm_ebitda_musd               NUMERIC(12, 1),
    ev_ebitda_multiple            NUMERIC(6, 2),
    ev_revenue_multiple           NUMERIC(6, 2),
    equity_contribution_pct       NUMERIC(5, 2),
    debt_ebitda_multiple          NUMERIC(6, 2),
    financing_structure_notes     TEXT,
    exit_date                    DATE,
    exit_type                    TEXT CHECK (
        exit_type IS NULL OR exit_type IN ('ipo', 'strategic_sale', 'secondary_sale', 'still_held')
    ),
    exit_multiple                NUMERIC(6, 2),
    moic                        NUMERIC(6, 2),
    irr_pct                     NUMERIC(6, 2),
    source_notes                 TEXT NOT NULL,
    created_at                   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_transactions_sector ON transactions (sector);
CREATE INDEX idx_transactions_sponsor ON transactions (acquirer_sponsor);
CREATE INDEX idx_transactions_deal_type ON transactions (deal_type);
CREATE INDEX idx_transactions_announced_date ON transactions (announced_date);
CREATE INDEX idx_transactions_ev_ebitda ON transactions (ev_ebitda_multiple);
