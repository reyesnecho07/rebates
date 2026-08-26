/*====================================================================================================================================*/
-- UpsertMaster_OCRG
-- UpsertMaster_OCRG - Upsert BP Group Master - NGR - 04/30/2026
-- Setup: Rebate Setup
/*====================================================================================================================================*/
DECLARE
	@GroupCode AS INT
SET @GroupCode = --Parameter
------------------------------------------------
DECLARE
	@list_of_cols_val_tab_del AS INT
SET @list_of_cols_val_tab_del = @GroupCode

--Upsert: Update if exists, Insert if not
IF EXISTS (SELECT 1 FROM OCRG WHERE GroupCode = @list_of_cols_val_tab_del)
	BEGIN
		UPDATE
			OCRG
		SET
			GroupName = T0.GroupName
		FROM
			[192.168.11.103].NEXCHEM.dbo.OCRG T0
		WHERE
			OCRG.GroupCode = @list_of_cols_val_tab_del
			AND T0.GroupCode = @list_of_cols_val_tab_del
	END
ELSE
	BEGIN
		--Check if #OCRG_TempTable exists
		IF OBJECT_ID('tempdb..#OCRG_TempTable') IS NOT NULL
			BEGIN
				DROP TABLE #OCRG_TempTable
			END
		CREATE TABLE #OCRG_TempTable
		(
			GroupCode  INT,
			GroupName  NVARCHAR(100)
		)

		--Insert into temp table
		INSERT INTO
			#OCRG_TempTable
		SELECT
			T0.GroupCode,
			T0.GroupName
		FROM
			[192.168.11.103].NEXCHEM.dbo.OCRG T0
		WHERE
			T0.GroupCode = @list_of_cols_val_tab_del

		--Insert into OCRG table from temp table
		INSERT INTO
			OCRG
		SELECT
			*
		FROM
			#OCRG_TempTable T0
		ORDER BY
			T0.GroupCode
		DROP TABLE #OCRG_TempTable
	END