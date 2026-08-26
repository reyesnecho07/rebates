/*====================================================================================================================================*/
-- UpsertMaster_OITM
-- UpsertMaster_OITM - Upsert Item Master - NGR - 04/30/2026
-- Setup: Rebate Setup
/*====================================================================================================================================*/
DECLARE
	@ItemCode AS NVARCHAR(20)
SET @ItemCode = --Parameter
------------------------------------------------
DECLARE
	@list_of_cols_val_tab_del AS NVARCHAR(20)
SET @list_of_cols_val_tab_del = @ItemCode

--Upsert: Update if exists, Insert if not
IF EXISTS (SELECT 1 FROM OITM WHERE ItemCode = @list_of_cols_val_tab_del)
	BEGIN
		UPDATE
			OITM
		SET
			ItemName = T0.ItemName,
			ItmsGrpCod = T0.ItmsGrpCod
		FROM
			[192.168.11.103].ZZZ_NEXCHEM_TEST.dbo.OITM T0
		WHERE
			OITM.ItemCode = @list_of_cols_val_tab_del
			AND T0.ItemCode = @list_of_cols_val_tab_del
	END
ELSE
	BEGIN
		--Check if #OITM_TempTable exists
		IF OBJECT_ID('tempdb..#OITM_TempTable') IS NOT NULL
			BEGIN
				DROP TABLE #OITM_TempTable
			END
		CREATE TABLE #OITM_TempTable
		(
			ItemCode    NVARCHAR(20),
			ItemName    NVARCHAR(100),
			ItmsGrpCod  INT
		)

		--Insert into temp table
		INSERT INTO
			#OITM_TempTable
		SELECT
			T0.ItemCode,
			T0.ItemName,
			T0.ItmsGrpCod
		FROM
			[192.168.11.103].ZZZ_NEXCHEM_TEST.dbo.OITM T0
		WHERE
			T0.ItemCode = @list_of_cols_val_tab_del
			AND NOT
				(
					-- This is used for getting inactive Item, but it has 'NOT' in 'AND' so that it gets an active Item.
					(
						T0.validFor = 'N'
						AND T0.frozenFor = 'Y'
						AND T0.frozenTo > CAST(GETDATE() AS DATE)
						AND ISNULL(T0.frozenTo, '') <> ''
					)
						OR
					(
						T0.validFor = 'Y'
						AND T0.frozenFor = 'N'
						AND T0.validTo < CAST(GETDATE() AS DATE)
						AND ISNULL(T0.validTo, '') <> ''
					)
						OR
					(
						T0.validFor = 'N'
						AND T0.frozenFor = 'Y'
						AND ISNULL(T0.frozenTo, '') = ''
					)
				)

		--Insert into OITM table from temp table
		INSERT INTO
			OITM
		SELECT
			*
		FROM
			#OITM_TempTable T0
		ORDER BY
			T0.ItemCode
		DROP TABLE #OITM_TempTable
	END