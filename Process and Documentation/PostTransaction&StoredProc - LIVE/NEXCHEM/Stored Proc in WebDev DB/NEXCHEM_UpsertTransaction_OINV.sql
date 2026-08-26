/*====================================================================================================================================*/
-- UpsertTransaction_OINV
-- UpserttTransaction_OINV - Upsert AR Invoice Transaction - NGR - 04/30/2026
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
IF EXISTS (SELECT 1 FROM OINV WHERE DocNum = (SELECT DocNum FROM [192.168.11.103].NEXCHEM.dbo.OINV WHERE DocEntry = @list_of_cols_val_tab_del))
	BEGIN
		UPDATE
			OINV
		SET
			U_BP_Code  = T0.U_BP_Code,
			U_AR_INV_NO = T0.U_AR_INV_NO
		FROM
			[192.168.11.103].NEXCHEM.dbo.OINV T0
		WHERE
			T0.DocEntry   = @list_of_cols_val_tab_del
			AND OINV.DocNum   = T0.DocNum
	END
ELSE
	BEGIN
		--Check if #OINV_TempTable exists
		IF OBJECT_ID('tempdb..#OINV_TempTable') IS NOT NULL
			BEGIN
				DROP TABLE #OINV_TempTable
			END
		CREATE TABLE #OINV_TempTable
		(
			DocNum      INT,
			DocDate     DATETIME,
			DocType     NVARCHAR(1),
			CardCode    NVARCHAR(15),
			CardName    NVARCHAR(100),
			U_BP_Code   NVARCHAR(15),
			U_AR_INV_NO NVARCHAR(254),
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
			GTotal      NUMERIC(19,6)
		)
		--Insert into temp table
		INSERT INTO
			#OINV_TempTable
		SELECT
			T0.DocNum,
			T0.DocDate,
			T0.DocType,
			T0.CardCode,
			T0.CardName,
			T0.U_BP_Code,
			T0.U_AR_INV_NO,
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
			[192.168.11.103].NEXCHEM.dbo.OINV T0
			INNER JOIN [192.168.11.103].NEXCHEM.dbo.INV1 T1 ON T0.DocEntry = T1.DocEntry
			INNER JOIN [192.168.11.103].NEXCHEM.dbo.OITM T2 ON T1.ItemCode = T2.ItemCode
			INNER JOIN [192.168.11.103].NEXCHEM.dbo.OITB T3 ON T2.ItmsGrpCod = T3.ItmsGrpCod AND T3.ItmsGrpNam IN ('CHEMICALS', 'FOLIAR', 'REBATES')
		WHERE
			T0.DocEntry = @list_of_cols_val_tab_del
			AND T0.DocDate >= '2025-01-01'
		--Insert into OINV table from temp table
		INSERT INTO
			OINV
		SELECT
			*
		FROM
			#OINV_TempTable T0
		ORDER BY
			T0.DocNum,
			T0.ItemCode
		DROP TABLE #OINV_TempTable
	END