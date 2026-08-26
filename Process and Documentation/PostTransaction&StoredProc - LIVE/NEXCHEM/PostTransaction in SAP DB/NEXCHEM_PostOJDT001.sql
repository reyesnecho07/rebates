/*====================================================================================================================================*/
-- PostOJDT001
-- PostOJDT001 - Post Journal Entry Transaction - NGR - 04/30/2026
-- Setup: Rebate Setup
/*====================================================================================================================================*/
IF @object_type = '30' AND @transaction_type IN ('A')
	BEGIN
		IF EXISTS
		(
			SELECT
				1
			FROM
				OJDT T0
				INNER JOIN JDT1 T1 ON T0.TransId = T1.TransId
			WHERE
				T0.TransId = @list_of_cols_val_tab_del
		)
			BEGIN
				IF DB_NAME() = 'NEXCHEM' --Live
					BEGIN
						EXEC [192.168.100.100].[NEXCHEM_DB-LIVE].dbo.InsertTransaction_OJDT @TransId = @list_of_cols_val_tab_del
					END
				ELSE IF DB_NAME() LIKE 'Z%NEXCHEM%' --Test
					BEGIN
						EXEC [192.168.100.100].[ZZZ_NEXCHEM_DB].dbo.InsertTransaction_OJDT @TransId = @list_of_cols_val_tab_del
					END
			END
	END