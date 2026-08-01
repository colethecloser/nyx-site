-- PE Deal Screener seed data
-- All companies and financials below are FICTIONAL / illustrative only.
-- They do not represent real, identifiable private companies or their actual financials.

DELETE FROM targets;

INSERT INTO targets
    (name, sector, revenue_musd, revenue_growth_pct, ebitda_musd, ebitda_margin_pct, net_debt_musd, capex_pct_revenue, fcf_musd, ask_ev_musd)
VALUES
    ('Northwind Cloud Systems', 'Software', 82.0, 34.0, 26.24, 32.0, 40.0, 3.0, 18.79, 380.48),
    ('Vantage Ledger Software', 'Software', 55.0, 8.0, 12.1, 22.0, 70.0, 2.5, 8.47, 145.2),
    ('BrightPath Analytics', 'Software', 40.0, 41.0, 11.2, 28.0, 10.0, 4.0, 7.58, 123.2),
    ('Ferro Data Solutions', 'Software', 120.0, 12.0, 21.6, 18.0, 95.0, 3.5, 13.75, 280.8),
    ('Solace Workflow Inc.', 'Software', 29.0, 26.0, 8.7, 30.0, 5.0, 2.0, 6.41, 82.65),
    ('Cascadia Compliance Cloud', 'Software', 66.0, 15.0, 16.5, 25.0, 30.0, 2.8, 11.58, 173.25),
    ('Ironclad Fabrication Co.', 'Industrials', 210.0, 4.0, 29.4, 14.0, 150.0, 6.0, 13.27, 249.9),
    ('Meridian Precision Machining', 'Industrials', 95.0, 9.0, 18.05, 19.0, 40.0, 5.0, 10.51, 126.35),
    ('Talus Industrial Coatings', 'Industrials', 130.0, 6.5, 21.45, 16.5, 85.0, 5.5, 11.3, 171.6),
    ('Anchor Bearing & Drive', 'Industrials', 68.0, 11.0, 14.28, 21.0, 20.0, 4.5, 8.86, 97.1),
    ('Redstone Fluid Power', 'Industrials', 175.0, 2.0, 21.0, 12.0, 160.0, 6.5, 7.6, 189.0),
    ('Palisade Metal Works', 'Industrials', 88.0, 7.5, 14.96, 17.0, 35.0, 5.0, 8.34, 112.2),
    ('Harborview Home Health', 'Healthcare Services', 140.0, 13.0, 28.0, 20.0, 55.0, 2.0, 19.91, 322.0),
    ('Crescent Dental Partners', 'Healthcare Services', 76.0, 17.0, 18.24, 24.0, 25.0, 1.8, 13.33, 182.4),
    ('Pinnacle Diagnostics Group', 'Healthcare Services', 205.0, 5.0, 30.75, 15.0, 180.0, 2.5, 20.24, 384.38),
    ('Willowbrook Behavioral Health', 'Healthcare Services', 58.0, 19.0, 12.76, 22.0, 18.0, 2.2, 9.07, 125.05),
    ('Sterling Urgent Care Network', 'Healthcare Services', 112.0, 9.0, 19.04, 17.0, 60.0, 2.0, 13.27, 205.63),
    ('Fairhaven Rehab Centers', 'Healthcare Services', 90.0, 6.0, 12.6, 14.0, 70.0, 2.4, 8.25, 148.68),
    ('Cobblestone Coffee Roasters', 'Consumer/Retail', 64.0, 14.0, 10.24, 16.0, 22.0, 3.0, 6.57, 92.16),
    ('Driftwood Outdoor Apparel', 'Consumer/Retail', 118.0, 3.0, 12.98, 11.0, 95.0, 3.5, 6.99, 123.31),
    ('Amberlight Home Goods', 'Consumer/Retail', 145.0, 5.5, 18.85, 13.0, 100.0, 3.2, 11.23, 165.88),
    ('Copperfield Specialty Foods', 'Consumer/Retail', 52.0, 16.0, 9.88, 19.0, 15.0, 2.5, 6.78, 81.02),
    ('Thistle & Vine Beauty Co.', 'Consumer/Retail', 47.0, 21.0, 10.81, 23.0, 10.0, 2.0, 7.8, 99.45),
    ('Keystone Advisory Partners', 'Business Services', 71.0, 12.0, 18.46, 26.0, 20.0, 1.0, 14.02, 193.83),
    ('Longview Staffing Solutions', 'Business Services', 160.0, 4.0, 14.4, 9.0, 120.0, 1.2, 9.86, 112.32),
    ('Ashgrove Facilities Management', 'Business Services', 98.0, 7.0, 11.76, 12.0, 60.0, 1.5, 8.13, 94.08),
    ('Beacon Payroll & HR Services', 'Business Services', 54.0, 18.0, 15.66, 29.0, 12.0, 0.8, 12.03, 172.26);
