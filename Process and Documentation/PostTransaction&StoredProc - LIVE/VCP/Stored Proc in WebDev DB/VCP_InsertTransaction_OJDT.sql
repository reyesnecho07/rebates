/*====================================================================================================================================*/
-- InsertTransaction_OJDT
-- InsertTransaction_OJDT - Insert Journal Entry Transaction - NGR - 04/30/2026
-- Setup: Rebate Setup
/*====================================================================================================================================*/
DECLARE
	@TransId AS INT
SET @TransId = --Parameter
------------------------------------------------
DECLARE
	@list_of_cols_val_tab_del AS INT
SET @list_of_cols_val_tab_del = @TransId

--Check if #OJDT_TempTable exists
IF OBJECT_ID('tempdb..#OJDT_TempTable') IS NOT NULL
	BEGIN
		DROP TABLE #OJDT_TempTable
	END
CREATE TABLE #OJDT_TempTable
(
	ShortName NVARCHAR(15),
	CardName  NVARCHAR(100),
	RefDate   DATETIME,
	TransId   INT,
	Account   NVARCHAR(15),
	AcctName  NVARCHAR(100),
	Debit     NUMERIC(19,6),
	Credit    NUMERIC(19,6),
	Memo      NVARCHAR(50),
	LineMemo  NVARCHAR(50)
)

--Insert into temp table
INSERT INTO
	#OJDT_TempTable
SELECT
    T2.ShortName,
    T4.CardName,
    T0.RefDate,
    T0.TransId,
    T1.Account,
    T3.AcctName,
    T1.Debit,
    T1.Credit,
    T0.Memo,
	T1.LineMemo
FROM
	[192.168.11.103].ZZZ_VCP_TEST.OJDT T0
	INNER JOIN [192.168.11.103].ZZZ_VCP_TEST.JDT1 T1 ON T0.TransId = T1.TransId
	INNER JOIN [192.168.11.103].ZZZ_VCP_TEST.JDT1 T2 ON T0.TransId = T2.TransId AND T2.ShortName IN (SELECT CardCode FROM [192.168.11.103].ZZZ_VCP_TEST.OCRD WHERE CardType = 'C')
	LEFT JOIN [192.168.11.103].ZZZ_VCP_TEST.OCRD T4 ON T2.ShortName = T4.CardCode
	LEFT JOIN [192.168.11.103].ZZZ_VCP_TEST.OACT T3 ON T1.Account = T3.AcctCode
WHERE
	T0.TransId = @list_of_cols_val_tab_del
	AND T3.AcctName LIKE '%Rebate%'

--Insert into OJDT table from temp table
INSERT INTO
	OJDT
SELECT
	*
FROM
	#OJDT_TempTable T0
WHERE
	NOT EXISTS
	(
		SELECT
			1
		FROM
			OJDT
		WHERE
			TransId = T0.TransId
	)
ORDER BY
	T0.TransId
DROP TABLE #OJDT_TempTable