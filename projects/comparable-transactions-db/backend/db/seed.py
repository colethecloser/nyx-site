"""
Seed script for the comparable_transactions database.

IMPORTANT: All financial figures in this dataset are ILLUSTRATIVE / APPROXIMATE.
Deal names and sponsors for real, publicly-reported buyouts are used for
portfolio-demo realism, but the specific EV, revenue, EBITDA, multiples,
leverage, MOIC and IRR figures are rounded/approximated illustrations, NOT
precise or verified deal data. Several rows use clearly fictional company and
sponsor names where we did not want to assert unverified figures about a real
deal. Do not use this data for real diligence or investment purposes.

Run with:
    DATABASE_URL=postgresql://postgres:postgres@localhost:5432/comparable_transactions python3 db/seed.py
"""
import os
import psycopg2

DATABASE_URL = os.environ.get(
    "DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/comparable_transactions"
)

APPROX_NOTE = "Figures are approximate/illustrative, rounded for a portfolio demo; based loosely on public reporting and not verified deal data."
FICTIONAL_NOTE = "Illustrative fictional transaction created for portfolio demo purposes; target, sponsor and all figures are invented and do not represent a real deal."

# Each tuple:
# (target_name, sector, announced_date, closed_date, acquirer_sponsor, deal_type,
#  ev_musd, ltm_rev_musd, ltm_ebitda_musd, equity_pct, debt_ebitda_x, financing_notes,
#  exit_date, exit_type, exit_multiple, moic, irr_pct, source_notes)
ROWS = [
    ("RJR Nabisco", "Consumer Products", "1988-10-24", "1989-02-09", "KKR", "going_private",
     25000, 16900, 2600, 15, 8.5, "Bridge loans + senior secured bank debt + subordinated debt + PIK preferred; landmark 1980s leverage structure",
     "1995-01-01", "strategic_sale", 1.4, 1.4, 8.0, APPROX_NOTE),

    ("Hilton Hotels Corp", "Hospitality", "2007-07-03", "2007-10-24", "Blackstone Group", "going_private",
     26000, 4200, 1400, 30, 6.7, "Term Loan B + commercial mortgage-backed securities (CMBS) financing + sponsor equity",
     "2013-12-12", "ipo", 12.0, 3.5, 20.0, APPROX_NOTE),

    ("TXU Corp (Energy Future Holdings)", "Energy / Utilities", "2007-02-26", "2007-10-10", "KKR / TPG / Goldman Sachs Capital Partners", "going_private",
     45000, 10800, 3800, 12, 8.0, "Senior secured term loans + second-lien notes + unsecured notes; largest LBO on record at the time",
     None, "still_held", None, 0.1, -25.0, APPROX_NOTE + " Company later filed for Chapter 11 bankruptcy in 2014; exit figures reflect that outcome, not a realized sale."),

    ("First Data Corp", "Payments / Fintech", "2007-04-02", "2007-09-24", "KKR", "going_private",
     29000, 8600, 2200, 24, 7.5, "Senior secured credit facilities (Term Loan B) + senior unsecured/subordinated notes",
     "2015-10-15", "ipo", 9.5, 2.1, 9.0, APPROX_NOTE),

    ("HCA Inc.", "Healthcare", "2006-07-24", "2006-11-17", "KKR / Bain Capital / Merrill Lynch Global PE", "going_private",
     33000, 24500, 4300, 15, 6.8, "Asset-backed revolver + Term Loan B + senior notes + senior toggle notes",
     "2011-03-09", "ipo", 8.5, 2.8, 20.0, APPROX_NOTE),

    ("Dell Inc.", "Technology / Hardware", "2013-02-05", "2013-10-30", "Silver Lake Partners / Michael Dell", "going_private",
     24900, 56900, 3700, 25, 4.5, "Term Loan B + senior secured notes + Michael Dell rollover equity + MSD Capital co-investment",
     "2018-12-28", "ipo", 10.0, 2.5, 15.0, APPROX_NOTE + " 2018 exit via Class V tracking stock exchange rather than a conventional IPO."),

    ("H.J. Heinz Company", "Consumer / Food & Beverage", "2013-02-14", "2013-06-07", "3G Capital / Berkshire Hathaway", "going_private",
     28000, 11600, 2400, 31, 5.8, "Term Loan B + senior secured notes + preferred equity from Berkshire Hathaway",
     "2015-07-02", "strategic_sale", 13.0, 1.6, 10.0, APPROX_NOTE + " Exit reflects the 2015 merger with Kraz Foods creating Kraft Heinz."),

    ("Dollar General Corp", "Retail", "2007-03-11", "2007-07-06", "KKR", "going_private",
     7300, 9200, 730, 27, 6.2, "Asset-based revolver + Term Loan B + senior subordinated notes",
     "2009-11-13", "ipo", 8.9, 3.2, 25.0, APPROX_NOTE),

    ("PetSmart Inc.", "Retail", "2014-12-14", "2015-03-11", "BC Partners (consortium incl. Longview, La Caisse, PSP)", "going_private",
     8700, 7000, 870, 33, 6.0, "Term Loan B + senior secured notes + senior unsecured notes",
     None, "still_held", None, 1.1, 3.0, APPROX_NOTE + " Consortium later carved out Chewy.com via a separate 2019 IPO while retaining PetSmart itself privately."),

    ("Univision Communications", "Media", "2006-06-27", "2007-03-29", "Madison Dearborn / Providence Equity / TPG / Thomas H. Lee / Saban Capital", "going_private",
     13700, 2000, 830, 22, 8.5, "Senior secured credit facilities + senior unsecured notes + senior subordinated notes",
     "2020-06-01", "strategic_sale", 6.5, 0.7, -4.0, APPROX_NOTE),

    ("Clear Channel Communications", "Media", "2006-11-16", "2008-07-30", "Bain Capital / Thomas H. Lee Partners", "going_private",
     24000, 6900, 2100, 20, 8.4, "Senior secured Term Loan B + senior cash-pay notes + senior toggle notes",
     None, "still_held", None, 0.2, -18.0, APPROX_NOTE + " Parent company underwent Chapter 11 restructuring in 2019-2020."),

    ("Alliance Boots", "Healthcare / Retail", "2007-04-23", "2007-06-27", "KKR", "going_private",
     22000, 15500, 1350, 26, 7.9, "Senior and mezzanine bank debt across multiple tranches; UK's largest LBO at the time",
     "2014-12-31", "strategic_sale", 10.5, 2.4, 12.0, APPROX_NOTE + " Exit reflects staged combination with Walgreens forming Walgreens Boots Alliance."),

    ("Kinder Morgan Inc.", "Energy / Infrastructure", "2006-05-29", "2007-05-30", "Goldman Sachs Capital Partners / Carlyle / Riverstone / Highstar + management", "going_private",
     22000, 12100, 2900, 33, 5.2, "Senior secured credit facilities + senior notes + significant management/sponsor equity co-invest",
     "2011-02-11", "ipo", 9.8, 2.0, 15.0, APPROX_NOTE),

    ("SunGard Data Systems", "Technology / Financial Software", "2005-03-28", "2005-08-11", "Silver Lake / Bain Capital / Blackstone / GS Capital Partners / KKR / Providence Equity / TPG", "going_private",
     11400, 4000, 1000, 26, 7.0, "Club deal across seven sponsors; senior secured Term Loan B + senior/subordinated notes",
     "2015-08-24", "strategic_sale", 8.0, 1.7, 5.0, APPROX_NOTE),

    ("Freescale Semiconductor", "Technology / Semiconductors", "2006-09-15", "2006-12-01", "Blackstone / Carlyle Group / Permira / TPG", "going_private",
     17600, 6400, 1300, 24, 7.6, "Senior secured Term Loan B + senior floating-rate notes + senior fixed-rate notes",
     "2011-05-25", "ipo", 6.0, 0.9, -2.0, APPROX_NOTE),

    ("Biomet Inc.", "Healthcare / Medical Devices", "2006-12-18", "2007-09-25", "Blackstone / Goldman Sachs Capital Partners / KKR / TPG", "going_private",
     11400, 2000, 620, 30, 7.3, "Senior secured credit facilities + senior/subordinated notes",
     "2015-04-24", "strategic_sale", 13.0, 2.3, 11.0, APPROX_NOTE),

    ("Harrah's Entertainment", "Gaming / Hospitality", "2006-10-02", "2008-01-28", "Apollo Global Management / TPG", "going_private",
     28000, 9700, 2100, 12, 9.2, "Senior secured Term Loan B + second-lien notes + unsecured notes; very high leverage entering 2008 downturn",
     "2012-02-08", "ipo", 5.5, 0.4, -15.0, APPROX_NOTE + " Renamed Caesars Entertainment; company later filed Chapter 11 in 2015."),

    ("Sabre Holdings", "Technology / Travel", "2006-12-11", "2007-03-30", "TPG / Silver Lake Partners", "going_private",
     4900, 2500, 610, 28, 6.5, "Senior secured Term Loan B + senior notes",
     "2014-04-17", "ipo", 9.0, 2.0, 10.0, APPROX_NOTE),

    ("Michaels Stores", "Retail", "2006-06-30", "2006-10-31", "Bain Capital / Blackstone Group", "going_private",
     6000, 3900, 480, 15, 8.1, "Asset-based revolver + Term Loan B + senior subordinated notes",
     "2014-06-27", "ipo", 8.5, 2.6, 16.0, APPROX_NOTE),

    ("Neiman Marcus Group", "Retail", "2013-05-30", "2013-10-25", "Ares Management / Canada Pension Plan Investment Board (CPPIB)", "secondary_buyout",
     6000, 4800, 660, 32, 6.0, "Term Loan B + senior secured/unsecured notes; acquired from prior sponsors TPG and Warburg Pincus",
     None, "still_held", None, 0.3, -20.0, APPROX_NOTE + " Company later underwent an out-of-court debt restructuring in 2020."),

    ("Toys \"R\" Us", "Retail", "2005-03-17", "2005-07-21", "KKR / Bain Capital / Vornado Realty Trust", "going_private",
     6600, 11000, 900, 21, 7.0, "Asset-based revolver + Term Loan B + mortgage/real-estate financing via Vornado JV",
     None, "still_held", None, 0.0, None, APPROX_NOTE + " Company liquidated in U.S. Chapter 11 bankruptcy in 2018; equity value effectively wiped out."),

    ("Panera Bread Company", "Consumer / Restaurants", "2017-04-05", "2017-07-18", "JAB Holding Company", "going_private",
     7500, 2800, 400, 45, 5.5, "Term Loan B + JAB sponsor equity; comparatively conservative leverage vs. peer set",
     None, "still_held", None, 1.6, 8.0, APPROX_NOTE),

    ("Staples Inc.", "Retail", "2017-06-28", "2017-09-12", "Sycamore Partners", "going_private",
     6900, 19700, 1000, 22, 6.5, "Term Loan B + senior secured notes + asset-based revolver",
     None, "still_held", None, 0.9, -3.0, APPROX_NOTE),

    ("Solera Holdings", "Technology / Insurance Software", "2015-09-13", "2016-03-01", "Vista Equity Partners", "going_private",
     6500, 900, 420, 33, 6.8, "Term Loan B + senior notes",
     None, "still_held", None, 1.9, 12.0, APPROX_NOTE),

    ("The Ultimate Software Group", "Technology / HR Software (SaaS)", "2019-02-04", "2019-05-03", "Hellman & Friedman (consortium incl. Blackstone, GIC, Canada Pension Plan)", "going_private",
     11000, 1140, 260, 40, 5.0, "Term Loan B + significant equity check reflecting high-growth SaaS profile",
     None, "still_held", None, 1.7, 15.0, APPROX_NOTE),

    ("Cloudera Inc.", "Technology / Data Software", "2021-06-01", "2021-10-08", "KKR / Clayton, Dubilier & Rice (CD&R)", "going_private",
     5300, 870, 90, 45, 4.8, "Term Loan B + senior secured notes; elevated EV/EBITDA reflecting EV/revenue-driven software valuation",
     None, "still_held", None, None, None, APPROX_NOTE),

    ("Citrix Systems", "Technology / Enterprise Software", "2022-01-31", "2022-09-30", "Vista Equity Partners / Evergreen Coast Capital (Elliott)", "going_private",
     16500, 3200, 970, 30, 6.5, "Term Loan B + senior secured notes issued amid a difficult 2022 leveraged loan market",
     None, "still_held", None, None, None, APPROX_NOTE + " Combined post-close with TIBCO Software to form Cloud Software Group."),

    ("Anaplan Inc.", "Technology / SaaS", "2022-03-20", "2022-06-21", "Thoma Bravo", "going_private",
     10700, 620, -10, 55, None, "Predominantly equity-funded given negative EBITDA at signing; modest Term Loan B",
     None, "still_held", None, None, None, APPROX_NOTE),

    ("Zendesk Inc.", "Technology / SaaS", "2022-06-24", "2022-11-22", "Permira / Hellman & Friedman", "going_private",
     10200, 1340, 30, 50, None, "Modest Term Loan B given thin EBITDA base; majority equity-funded",
     None, "still_held", None, None, None, APPROX_NOTE),

    ("athenahealth Inc.", "Healthcare / Technology", "2018-11-11", "2019-02-11", "Veritas Capital / Evergreen Coast Capital (Elliott)", "going_private",
     5700, 1300, 260, 38, 5.7, "Term Loan B + senior secured notes",
     "2022-01-25", "secondary_sale", 20.0, 2.6, 20.0, APPROX_NOTE),

    ("athenahealth Inc.", "Healthcare / Technology", "2021-12-22", "2022-02-15", "Bain Capital / Hellman & Friedman", "secondary_buyout",
     17000, 1500, 470, 35, 6.0, "Term Loan B + senior secured notes; acquired from prior sponsors Veritas Capital and Evergreen Coast Capital",
     None, "still_held", None, None, None, APPROX_NOTE),

    # --- Illustrative fictional deals (invented names) to round out deal_type coverage ---
    ("Meridian Industrial Coatings", "Industrials", "2015-04-10", "2015-07-01", "Clearwater Capital Partners", "carve_out",
     850, 620, 95, 40, 4.5, "Term Loan B + seller financing note; carved out of a diversified industrials parent",
     "2021-05-01", "strategic_sale", 8.5, 2.2, 14.0, FICTIONAL_NOTE),

    ("Beacon Diagnostics Group", "Healthcare", "2018-09-05", "2018-12-14", "Cobalt Ridge Partners", "carve_out",
     1200, 480, 140, 38, 5.0, "Term Loan B + revolver; carved out of a larger diversified life sciences conglomerate",
     None, "still_held", None, 1.5, 9.0, FICTIONAL_NOTE),

    ("Atlas Fleet Logistics", "Industrials / Transportation", "2020-02-20", "2020-06-01", "Bridgeview Capital", "carve_out",
     640, 510, 78, 42, 4.2, "Term Loan B + equipment financing lines; carved out from a large logistics conglomerate's non-core division",
     None, "still_held", None, 1.2, 6.0, FICTIONAL_NOTE),

    ("Sterling Test & Measurement", "Industrials / Technology", "2019-11-01", "2020-02-10", "Northbridge Partners", "carve_out",
     980, 410, 130, 36, 4.8, "Term Loan B + delayed-draw term loan for integration capex",
     "2024-03-01", "strategic_sale", 10.0, 2.0, 18.0, FICTIONAL_NOTE),

    ("Nimbus Cloud Analytics", "Technology / SaaS", "2021-03-15", "2021-05-20", "Summit Growth Partners", "growth_buyout",
     420, 95, 12, 65, 3.0, "Minority-plus growth equity check with modest term loan; founder rollover of majority stake",
     None, "still_held", None, 1.8, 22.0, FICTIONAL_NOTE),

    ("Verdant Foods Co", "Consumer / Food & Beverage", "2019-08-01", "2019-10-15", "Meridian Growth Capital", "growth_buyout",
     260, 140, 22, 55, 3.5, "Growth equity + small acquisition line for bolt-on M&A",
     "2023-06-01", "strategic_sale", 12.0, 2.5, 20.0, FICTIONAL_NOTE),

    ("Orbital Payments", "Fintech / Payments", "2022-01-10", "2022-03-01", "Falcon Ridge Capital", "growth_buyout",
     510, 88, 15, 60, 3.2, "Growth equity plus a modest revolver for working capital",
     None, "still_held", None, None, None, FICTIONAL_NOTE),

    ("Crestline Packaging", "Industrials / Packaging", "2016-05-12", "2016-08-01", "Blue Harbor Capital", "secondary_buyout",
     1450, 980, 175, 34, 5.8, "Term Loan B + senior notes; acquired from prior sponsor Founder Equity Partners",
     "2022-09-01", "strategic_sale", 9.5, 2.1, 15.0, FICTIONAL_NOTE),

    ("Palisade Software Solutions", "Technology / Enterprise Software", "2020-10-01", "2020-12-18", "Westgate Partners", "secondary_buyout",
     2100, 340, 88, 37, 5.5, "Term Loan B + senior secured notes; acquired from prior sponsor Anchor Point Capital",
     None, "still_held", None, 1.4, 10.0, FICTIONAL_NOTE),
]


def compute_multiples(ev, rev, ebitda):
    ev_rev = round(ev / rev, 2) if rev else None
    ev_ebitda = round(ev / ebitda, 2) if ebitda and ebitda > 0 else None
    return ev_ebitda, ev_rev


def main():
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    cur.execute("DELETE FROM transactions")

    insert_sql = """
        INSERT INTO transactions (
            target_name, sector, announced_date, closed_date, acquirer_sponsor, deal_type,
            enterprise_value_musd, ltm_revenue_musd, ltm_ebitda_musd,
            ev_ebitda_multiple, ev_revenue_multiple,
            equity_contribution_pct, debt_ebitda_multiple, financing_structure_notes,
            exit_date, exit_type, exit_multiple, moic, irr_pct, source_notes
        ) VALUES (
            %s, %s, %s, %s, %s, %s,
            %s, %s, %s,
            %s, %s,
            %s, %s, %s,
            %s, %s, %s, %s, %s, %s
        )
    """

    for row in ROWS:
        (target_name, sector, announced_date, closed_date, acquirer_sponsor, deal_type,
         ev, rev, ebitda, equity_pct, debt_ebitda_x, financing_notes,
         exit_date, exit_type, exit_multiple, moic, irr_pct, source_notes) = row

        ev_ebitda, ev_rev = compute_multiples(ev, rev, ebitda)

        cur.execute(insert_sql, (
            target_name, sector, announced_date, closed_date, acquirer_sponsor, deal_type,
            ev, rev, ebitda,
            ev_ebitda, ev_rev,
            equity_pct, debt_ebitda_x, financing_notes,
            exit_date, exit_type, exit_multiple, moic, irr_pct, source_notes,
        ))

    conn.commit()
    cur.execute("SELECT count(*) FROM transactions")
    print(f"Inserted rows. Total transactions: {cur.fetchone()[0]}")
    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
