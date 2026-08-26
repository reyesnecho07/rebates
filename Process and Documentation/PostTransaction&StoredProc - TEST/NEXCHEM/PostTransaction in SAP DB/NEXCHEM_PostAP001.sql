/*====================================================================================================================================*/
-- PostAP001
-- PostAP001 - Post AP Invoice Transaction - NGR - 04/30/2026
-- Setup: Rebate Setup
/*====================================================================================================================================*/
IF @object_type = '18' AND @transaction_type IN ('A', 'U')
	BEGIN
		IF EXISTS
		(
			SELECT
				1
			FROM
				OPCH T0
				INNER JOIN PCH1 T1 ON T0.DocEntry = T1.DocEntry
			WHERE
				T0.DocEntry = @list_of_cols_val_tab_del
		)
			BEGIN
				IF DB_NAME() = 'NEXCHEM' --Live
					BEGIN
						EXEC [192.168.100.100].[NEXCHEM_DB-LIVE].dbo.UpsertTransaction_OPCH @DocEntry = @list_of_cols_val_tab_del
					END
				ELSE IF DB_NAME() LIKE 'Z%NEXCHEM%' --Test
					BEGIN
						EXEC [192.168.100.100].[ZZZ_NEXCHEM_DB].dbo.UpsertTransaction_OPCH @DocEntry = @list_of_cols_val_tab_del
					END
			END
	END