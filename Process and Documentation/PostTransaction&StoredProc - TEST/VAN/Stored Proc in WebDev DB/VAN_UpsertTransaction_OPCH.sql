/*====================================================================================================================================*/
-- UpsertTransaction_OPCH
-- UpsertTransaction_OPCH - Insert AP Invoice Transaction - NGR - 04/30/2026
-- Setup: Rebate Setup
/*====================================================================================================================================*/
DECLARE
	@DocEntry AS INT
SET @DocEntry = --Parameter
------------------------------------------------
DECLARE
	@list_of_cols_val_tab_del AS INT
SET @list_of_cols_val_tab_del = @DocEntry
--Upsert: Update if exists, Insert if not
IF EXISTS (SELECT 1 FROM OPCH WHERE DocNum = (SELECT DocNum FROM [192.168.11.103].ZZZ_VAN_TEST.dbo.OPCH WHERE DocEntry = @list_of_cols_val_tab_del))
	BEGIN
		UPDATE
			OPCH
		SET
			U_BP_Code  = T0.U_BP_Code
		FROM
			[192.168.11.103].ZZZ_VAN_TEST.dbo.OPCH T0
		WHERE
			T0.DocEntry   = @list_of_cols_val_tab_del
			AND OPCH.DocNum   = T0.DocNum
	END
ELSE
	BEGIN
		--Check if #OPCH_TempTable exists
		IF OBJECT_ID('tempdb..#OPCH_TempTable') IS NOT NULL
			BEGIN
				DROP TABLE #OPCH_TempTable
			END
		CREATE TABLE #OPCH_TempTable
		(
			DocNum      INT,
			DocDate     DATETIME,
			DocType     NVARCHAR(1),
			CardCode    NVARCHAR(15),
			CardName    NVARCHAR(100),
			U_BP_Code   NVARCHAR(15),
			ItemCode    NVARCHAR(20),
			Dscription  NVARCHAR(100),
			Quantity    NUMERIC(19,6),
			PriceBefDi  NUMERIC(19,6),
			PriceAfVAT  NUMERIC(19,6),
			AcctCode    NVARCHAR(15),
			TreeType    NVARCHAR(1),
			BaseType    INT,
			BaseRef     INT,
			LineTotal   NUMERIC(19,6),
			GTotal      NUMERIC(19,6
		)
		--Insert into temp table
		INSERT INTO
			#OPCH_TempTable
		SELECT
			T0.DocNum,
			T0.DocDate,
			T0.DocType,
			T0.CardCode,
			T0.CardName,
			T0.U_BP_Code,
			T1.ItemCode,
			T1.Dscription,
			T1.Quantity,
			T1.PriceBefDi,
			T1.PriceAfVAT,
			T1.AcctCode,
			T1.TreeType,
			T1.BaseType,
			T1.BaseRef,
			T1.LineTotal,
			T1.GTotal
		FROM
			[192.168.11.103].ZZZ_VAN_TEST.dbo.OPCH T0
			INNER JOIN [192.168.11.103].ZZZ_VAN_TEST.dbo.PCH1 T1 ON T0.DocEntry = T1.DocEntry
		WHERE
			T0.DocEntry = @list_of_cols_val_tab_del
			AND T1.AcctCode = '611902'
			AND T0.DocType  = 'S'
			AND T0.DocDate  >= '2025-01-01'
		--Insert into OPCH table from temp table
		INSERT INTO
			OPCH
		SELECT
			*
		FROM
			#OPCH_TempTable T0
		ORDER BY
			T0.DocNum,
			T0.ItemCode
		DROP TABLE #OPCH_TempTable
	END