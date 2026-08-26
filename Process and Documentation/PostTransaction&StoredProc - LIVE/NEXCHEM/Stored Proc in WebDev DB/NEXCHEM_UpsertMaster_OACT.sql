/*====================================================================================================================================*/
-- UpsertMaster_OACT
-- UpsertMaster_OACT - Upsert G/L Account - NGR - 04/30/2026
-- Setup: Rebate Setup
/*====================================================================================================================================*/
DECLARE
	@AcctCode AS NVARCHAR(15)
SET @AcctCode = --Parameter
------------------------------------------------
DECLARE
	@list_of_cols_val_tab_del AS NVARCHAR(15)
SET @list_of_cols_val_tab_del = @AcctCode

--Upsert: Update if exists, Insert if not
IF EXISTS (SELECT 1 FROM OACT WHERE AcctCode = @list_of_cols_val_tab_del)
	BEGIN
		UPDATE
			OACT
		SET
			AcctName = T0.AcctName
		FROM
			[192.168.11.103].NEXCHEM.dbo.OACT T0
		WHERE
			OACT.AcctCode = @list_of_cols_val_tab_del
			AND T0.AcctCode = @list_of_cols_val_tab_del
	END
ELSE
	BEGIN
		--Check if #OACT_TempTable exists
		IF OBJECT_ID('tempdb..#OACT_TempTable') IS NOT NULL
			BEGIN
				DROP TABLE #OACT_TempTable
			END
		CREATE TABLE #OACT_TempTable
		(
			AcctCode  NVARCHAR(15),
			AcctName  NVARCHAR(100)
		)

		--Insert into temp table
		INSERT INTO
			#OACT_TempTable
		SELECT
			T0.AcctCode,
			T0.AcctName
		FROM
			[192.168.11.103].NEXCHEM.dbo.OACT T0
		WHERE
			T0.AcctCode = @list_of_cols_val_tab_del
			AND T0.AcctName LIKE '%Rebate%'

		--Insert into OACT table from temp table
		INSERT INTO
			OACT
		SELECT
			*
		FROM
			#OACT_TempTable T0
		ORDER BY
			T0.AcctCode
		DROP TABLE #OACT_TempTable
	END