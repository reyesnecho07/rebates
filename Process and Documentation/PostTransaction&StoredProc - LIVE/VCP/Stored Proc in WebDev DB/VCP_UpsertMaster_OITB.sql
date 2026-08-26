/*====================================================================================================================================*/
-- UpsertMaster_OITB
-- UpsertMaster_OITB - Upsert Item Group - NGR - 04/30/2026
-- Setup: Rebate Setup
/*====================================================================================================================================*/
DECLARE
	@ItmsGrpCod AS INT
SET @ItmsGrpCod = --Parameter
------------------------------------------------
DECLARE
	@list_of_cols_val_tab_del AS INT
SET @list_of_cols_val_tab_del = @ItmsGrpCod

--Upsert: Update if exists, Insert if not
IF EXISTS (SELECT 1 FROM OITB WHERE ItmsGrpCod = @list_of_cols_val_tab_del)
	BEGIN
		UPDATE
			OITB
		SET
			ItmsGrpNam = T0.ItmsGrpNam
		FROM
			[192.168.11.103].ZZZ_VCP_TEST.OITB T0
		WHERE
			OITB.ItmsGrpCod = @list_of_cols_val_tab_del
			AND T0.ItmsGrpCod = @list_of_cols_val_tab_del
	END
ELSE
	BEGIN
		--Check if #OITB_TempTable exists
		IF OBJECT_ID('tempdb..#OITB_TempTable') IS NOT NULL
			BEGIN
				DROP TABLE #OITB_TempTable
			END
		CREATE TABLE #OITB_TempTable
		(
			ItmsGrpCod  INT,
			ItmsGrpNam  NVARCHAR(20)
		)

		--Insert into temp table
		INSERT INTO
			#OITB_TempTable
		SELECT
			T0.ItmsGrpCod,
			T0.ItmsGrpNam
		FROM
			[192.168.11.103].ZZZ_VCP_TEST.OITB T0
		WHERE
			T0.ItmsGrpCod = @list_of_cols_val_tab_del

		--Insert into OITB table from temp table
		INSERT INTO
			OITB
		SELECT
			*
		FROM
			#OITB_TempTable T0
		ORDER BY
			T0.ItmsGrpCod
		DROP TABLE #OITB_TempTable
	END