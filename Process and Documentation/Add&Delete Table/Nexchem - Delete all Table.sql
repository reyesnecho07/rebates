--Drop first the Constraint
ALTER TABLE dbo.FixCustQuota
DROP CONSTRAINT FK__FixCustQu__CustR__6EF57B66;

ALTER TABLE dbo.PerCustQuota
DROP CONSTRAINT FK_PerCustQuota_PerCustRebate;

ALTER TABLE dbo.PerProdRebate
DROP CONSTRAINT FK_PerProdRebate_RebateProgram;


--Delete all the data in each table
TRUNCATE TABLE FixCustQuota;
TRUNCATE TABLE FixCustRebate;

TRUNCATE TABLE PerCustQuota;
TRUNCATE TABLE PerCustRebate;

TRUNCATE TABLE PerProdRebate;
TRUNCATE TABLE RebateProgram;

TRUNCATE TABLE FixProdRebate;
TRUNCATE TABLE IncCustRange;
TRUNCATE TABLE IncCustRebate;
TRUNCATE TABLE IncItemRange;
TRUNCATE TABLE IncItemRebate;
TRUNCATE TABLE PayoutHistory;


--Put back all the constraint
ALTER TABLE dbo.FixCustQuota
ADD CONSTRAINT FK__FixCustQu__CustR__6EF57B66
FOREIGN KEY (CustRebateId)
REFERENCES dbo.FixCustRebate(Id);

ALTER TABLE dbo.PerCustQuota
ADD CONSTRAINT FK_PerCustQuota_PerCustRebate
FOREIGN KEY (PerCustRebateId)
REFERENCES dbo.PerCustRebate(Id);

ALTER TABLE dbo.PerProdRebate
ADD CONSTRAINT FK_PerProdRebate_RebateProgram
FOREIGN KEY (RebateCode)
REFERENCES dbo.RebateProgram(RebateCode);