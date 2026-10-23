# The reconciliation gap: a Hungarian market opportunity

Status: opportunity brief, September 2026
Author: Ledgerworks

---

## 1. The forcing event

On **31 December 2026 ÁNYK stops being usable for VAT returns.** From
1 January 2027 a Hungarian VAT return can only be filed through the eÁFA web
interface or through an M2M (machine-to-machine) connection. The first return
that has no escape hatch is the **December 2026 monthly return, due
20 January 2027** — roughly seventeen weeks from today.

This is not a format change. eÁFA is **transaction-level**. The return is no
longer a set of summary figures a bookkeeper types into a form; it is assembled
from data NAV already holds about the taxpayer — Online Számla invoices, online
cash register receipts, customs decisions — cross-checked against the
taxpayer's own VAT analytics, and validated line by line before it is accepted.

Three things landed alongside it:

- **eÁFA M2M 2.0 XSD** went live and became mandatory on 3 August 2026; the 1.0
  schema is gone.
- **Receipt data reporting (nyugtaadat-szolgáltatás)** became mandatory on
  1 September 2026 for every business obliged to issue receipts that doesn't
  already transmit automatically. Hardware e-pénztárgép is phased separately to
  July 2028 — the obligation people are being mis-sold hardware for is a *data*
  obligation.
- **The data reconciliation procedure (adategyeztetési eljárás)** entered the
  tax procedure rules on 1 January 2025. NAV now has a formal instrument for
  chasing mismatches between what two partners reported about the same
  transaction.

## 2. What everybody is selling, and what nobody is selling

Every accounting software vendor in Hungary is shipping the same thing: **the
pipe.** "We can produce the M2M XML. We can submit your return." Kulcs-Soft,
Novitax, Régens and the rest are all racing on submission.

Nobody at the SME end is selling **the content check**: *does your ledger
actually agree with the copy of your business that NAV is holding?*

That question was invisible until now. When the return was summary figures,
a supplier invoice that was never booked, a tax number that was suspended
mid-year, a VAT code that disagrees with what the issuer reported — none of it
surfaced. From January each one is a validation failure, a rejected return, or
an adategyeztetési eljárás.

The Big Four have productized exactly this, as bespoke advisory, for large
corporates (PwC SmartTax, RSM, Deloitte all market eÁFA data-quality work). The
price point starts around where an SME's annual accounting fee ends.

**The gap is the entire middle of the market.**

## 3. Why the gap can't close itself

Hungary has roughly **16,000 actively practising bookkeepers** — against 40–50k
registered mérlegképes könyvelő, most of whom don't practise. That is about
**14–15 active companies per practising bookkeeper.** The profession is ageing;
fewer bookkeepers qualify each year than retire; the under-40 share has been
falling for years. Fees are rising because capacity, not demand, is the
constraint.

So the country has, by legal force, built the most complete machine-readable
record of business transactions in the EU — and has no human capacity left to
reconcile against it.

That asymmetry is the opportunity. The raw material is free, authoritative,
complete and state-mandated. The labour that would normally turn it into value
does not exist.

## 4. The product

**A read-only reconciliation between a company's books and NAV's own copy of
that company — run as a pre-flight before every VAT return.**

The mechanism, once built:

1. The client authorises a read-only Online Számla technical user.
2. The agent pulls 12–24 months, both directions (`queryInvoiceDigest` /
   `queryInvoiceData`, `INBOUND` and `OUTBOUND`), plus receipt data.
3. It cross-checks that against the taxpayer registries — tax number validity
   and suspension, VIES, the reliable/risky taxpayer lists — **at each
   transaction's own date**, not today's.
4. It outputs a discrepancy report: invoices NAV holds that the books don't,
   books entries NAV has no record of, duplicates, VAT code disagreements
   between issuer and recipient, counterparties whose status changed while
   they were invoicing you — each with the forint amount of VAT at risk.

### Why this is a different kind of value creation

- **The input is free and perfect.** No bank-feed integration, no Open Banking
  consent churn, no OCR, no data entry. The state collected it and is legally
  obliged to hand it back to the taxpayer.
- **It sells discrepancy, not seats or hours.** The output is denominated in
  forints of VAT at risk, so pricing anchors to exposure avoided rather than to
  headcount. A report that finds 2.4M Ft of exposure justifies its own fee
  without an argument.
- **It routes through the bottleneck instead of around it.** The buyer isn't
  800,000 companies; it's the ~16,000 bookkeepers whose capacity ceiling *is*
  the problem. A tool that lets a two-person office take 60 clients instead of
  30 sells itself to the person who otherwise turns work away.
- **Incumbents structurally can't do it.** A software vendor only sees the data
  inside its own system. The whole product is the comparison between that system
  and NAV's — which means the vendor is one of the two things being compared.

### Why it is fillable by one person

- Read-only. No filing, no money movement, no custody.
- No licence, no accounting qualification — it is diagnostic, not a return.
- Cannot break a client's filing: it never writes to NAV.
- The API is public, documented and versioned, with open-source client
  libraries in several languages.
- Liability stays advisory, which is both the ceiling on price and the reason
  a solo operator can carry it.

## 5. Staging

**Stage 0 — now, shipped.** A paid Hungarian-language diagnostic that needs no
NAV credentials: eight questions, an LLM agent, out comes a dated migration
plan — which route (web vs M2M) the company is on and why, its own deadlines,
what breaks in January, the data-quality risks specific to its profile, a
week-by-week plan to 20 January, and the questions to put to its bookkeeper and
its software vendor. Priced at 34,900 Ft. This is 90% reuse of the existing
build-brief machinery. Its real job is to prove willingness to pay and build
the list before Stage 1 exists.

**Stage 1 — 4 to 8 weeks.** The NAV-connected version. Read-only Online Számla
pull, the real discrepancy report, sold once per company as an "eÁFA pre-flight"
at roughly 90–250k Ft depending on volume.

**Stage 2 — recurring.** Monthly pre-flight before each VAT return, sold per
client-month through bookkeeping offices at a wholesale rate they mark up or use
to defend their own fee increase. This is the actual business; Stages 0 and 1
are how it gets funded and distributed.

## 6. The window

October to December 2026. The demand is created by a date, not by persuasion,
and it collapses once companies are migrated. Stage 0 has to be selling within
days, not after Stage 1 is perfect.

Channels that match a solo operator: the bookkeeper Facebook groups (tens of
thousands of members, currently full of eÁFA panic), adozona.hu and Adó Online
comment sections, MKOE and the county chambers, and direct outbound to small
bookkeeping offices, who are the reseller channel for Stage 2 anyway.

## 7. Honest risks

- **The deadline could move again.** It has moved before — the NIS2 audit
  deadline slipped a year for exactly the capacity reason described here. If
  ÁNYK gets a stay of execution, Stage 0 revenue evaporates. Stage 1 and 2 do
  not: the reconciliation problem is created by eÁFA existing, not by ÁNYK
  dying.
- **Vendors may add reconciliation.** They will, eventually, for their own
  data. The cross-vendor case — a bookkeeper running six different client
  systems — is the defensible one.
- **Credential trust is the real barrier.** Asking an SME for a NAV technical
  user is a big ask from an unknown supplier. Mitigations: read-only scope,
  written scope limits, the bookkeeper as the trusted intermediary rather than
  going direct to the company.
- **Advisory-only caps the price.** Staying out of the filing path is what
  keeps one person able to carry this, and also what stops it commanding
  filing-path money. That is the correct trade at this size.
- **Seasonality.** VAT returns cluster on the 20th. Stage 2 load is spiky and
  the month-end is the only moment the product matters.
