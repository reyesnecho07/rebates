-- =============================================
-- DROP EXISTING FOREIGN KEY CONSTRAINTS
-- =============================================

ALTER TABLE dbo.PerCustQuota
DROP CONSTRAINT FK_PerCustQuota_PerCustRebate;

ALTER TABLE dbo.PerProdRebate
DROP CONSTRAINT FK_PerProdRebate_RebateProgram;


-- =============================================
-- TRUNCATE TABLES
-- =============================================

TRUNCATE TABLE dbo.FixCustQuota;
TRUNCATE TABLE dbo.FixCustRebate;

TRUNCATE TABLE dbo.PerCustQuota;
TRUNCATE TABLE dbo.PerCustRebate;

TRUNCATE TABLE dbo.PerProdRebate;
TRUNCATE TABLE dbo.RebateProgram;

TRUNCATE TABLE dbo.FixProdRebate;
TRUNCATE TABLE dbo.IncCustRange;
TRUNCATE TABLE dbo.IncCustRebate;
TRUNCATE TABLE dbo.IncItemRange;
TRUNCATE TABLE dbo.IncItemRebate;
TRUNCATE TABLE dbo.PayoutHistory;


-- =============================================
-- RECREATE FOREIGN KEY CONSTRAINTS
-- =============================================

ALTER TABLE dbo.PerCustQuota
ADD CONSTRAINT FK_PerCustQuota_PerCustRebate
FOREIGN KEY (PerCustRebateId)
REFERENCES dbo.PerCustRebate(Id);

ALTER TABLE dbo.PerProdRebate
ADD CONSTRAINT FK_PerProdRebate_RebateProgram
FOREIGN KEY (RebateCode)
REFERENCES dbo.RebateProgram(RebateCode);