/*====================================================================================================================================*/
-- UpsertMaster_OSLP
-- UpsertMaster_OSLP - Upsert Sales Person Master - NGR - 04/30/2026
-- Setup: Rebate Setup
/*====================================================================================================================================*/
DECLARE
	@SlpCode AS INT
SET @SlpCode = --Parameter
------------------------------------------------
DECLARE
	@list_of_cols_val_tab_del AS INT
SET @list_of_cols_val_tab_del = @SlpCode

--Upsert: Update if exists, Insert if not
IF EXISTS (SELECT 1 FROM OSLP WHERE SlpCode = @list_of_cols_val_tab_del)
	BEGIN
		UPDATE
			OSLP
		SET
			SlpName = T0.SlpName
		FROM
			[192.168.11.103].NEXCHEM.dbo.OSLP T0
		WHERE
			OSLP.SlpCode = @list_of_cols_val_tab_del
			AND T0.SlpCode = @list_of_cols_val_tab_del
	END
ELSE
	BEGIN
		--Check if #OSLP_TempTable exists
		IF OBJECT_ID('tempdb..#OSLP_TempTable') IS NOT NULL
			BEGIN
				DROP TABLE #OSLP_TempTable
			END
		CREATE TABLE #OSLP_TempTable
		(
			SlpCode  INT,
			SlpName  NVARCHAR(155)
		)

		--Insert into temp table
		INSERT INTO
			#OSLP_TempTable
		SELECT
			T0.SlpCode,
			T0.SlpName
		FROM
			[192.168.11.103].NEXCHEM.dbo.OSLP T0
		WHERE
			T0.SlpCode = @list_of_cols_val_tab_del
			AND T0.Active = 'Y'

		--Insert into OSLP table from temp table
		INSERT INTO
			OSLP
		SELECT
			*
		FROM
			#OSLP_TempTable T0
		ORDER BY
			T0.SlpCode
		DROP TABLE #OSLP_TempTable
	END