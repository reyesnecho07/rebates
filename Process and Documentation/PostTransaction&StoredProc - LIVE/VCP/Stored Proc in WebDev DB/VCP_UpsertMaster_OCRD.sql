/*====================================================================================================================================*/
-- UpsertMaster_OCRD
-- Upsertter_OCRD - Upsert ss PartnBusineer Master - NGR - 04/30/2026
-- Setup: Rebate SetupMas
/*====================================================================================================================================*/
DECLARE
	@CardCode AS NVARCHAR(15)
SET @CardCode = --Parameter
------------------------------------------------
DECLARE
	@list_of_cols_val_tab_del AS NVARCHAR(15)
SET @list_of_cols_val_tab_del = @CardCode

--Upsert: Update if exists, Insert if not
IF EXISTS (SELECT 1 FROM OCRD WHERE CardCode = @list_of_cols_val_tab_del)
	BEGIN
		UPDATE
			OCRD
		SET
			CardName = T0.CardName,
			GroupCode = T0.GroupCode,
			SlpCode = T0.SlpCode
		FROM
			[192.168.11.103].ZZZ_VCP_TEST.OCRD T0
		WHERE
			OCRD.CardCode = @list_of_cols_val_tab_del
			AND T0.CardCode = @list_of_cols_val_tab_del
	END
ELSE
	BEGIN
		--Check if #OCRD_TempTable exists
		IF OBJECT_ID('tempdb..#OCRD_TempTable') IS NOT NULL
			BEGIN
				DROP TABLE #OCRD_TempTable
			END
		CREATE TABLE #OCRD_TempTable
		(
			CardCode   NVARCHAR(15),
			CardName   NVARCHAR(100),
			GroupCode  INT,
			SlpCode    INT
		)

		--Insert into temp table
		INSERT INTO
			#OCRD_TempTable
		SELECT
			T0.CardCode,
			T0.CardName,
			T0.GroupCode,
			T0.SlpCode
		FROM
			[192.168.11.103].ZZZ_VCP_TEST.OCRD T0
		WHERE
			T0.CardCode = @list_of_cols_val_tab_del
            AND T0.CardType = 'C'

		--Insert into OCRD table from temp table
		INSERT INTO
			OCRD
		SELECT
			*
		FROM
			#OCRD_TempTable T0
		ORDER BY
			T0.CardCode
		DROP TABLE #OCRD_TempTable
	END