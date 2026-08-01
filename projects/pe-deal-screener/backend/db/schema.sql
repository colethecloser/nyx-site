-- PE Deal Screener: targets table schema
-- All figures in USD millions (musd) unless noted otherwise; percentages as e.g. 22.5 for 22.5%.

DROP TABLE IF EXISTS targets;

CREATE TABLE targets (
    id                      SERIAL PRIMARY KEY,
    name                    TEXT NOT NULL,
    sector                  TEXT NOT NULL,
    revenue_musd            NUMERIC(12, 2) NOT NULL,
    revenue_growth_pct      NUMERIC(6, 2) NOT NULL,   -- YoY revenue growth, e.g. 18.50
    ebitda_musd             NUMERIC(12, 2) NOT NULL,
    ebitda_margin_pct       NUMERIC(6, 2) NOT NULL,   -- ebitda / revenue * 100, stored explicitly
    net_debt_musd           NUMERIC(12, 2) NOT NULL,  -- existing net debt at the target, pre-transaction
    capex_pct_revenue       NUMERIC(6, 2) NOT NULL,   -- capex as % of revenue
    fcf_musd                NUMERIC(12, 2) NOT NULL,  -- = ebitda - capex - simplified cash taxes, stored explicitly
    ask_ev_musd             NUMERIC(12, 2) NOT NULL,  -- seller's asking enterprise value
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_targets_sector ON targets (sector);
