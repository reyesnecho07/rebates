/*====================================================================================================================================*/
-- PostAR001
-- PostAR001 - Post AR Invoice Transaction - NGR - 04/30/2026
-- Setup: Rebate Setup
/*====================================================================================================================================*/
IF @object_type = '13' AND @transaction_type IN ('A', 'U')
	BEGIN
		IF EXISTS
		(
			SELECT
				1
			FROM
				OINV T0
				INNER JOIN INV1 T1 ON T0.DocEntry = T1.DocEntry
			WHERE
				T0.DocEntry = @list_of_cols_val_tab_del
		)
			BEGIN
				IF DB_NAME() = 'VCP' --Live
					BEGIN
						EXEC [192.168.100.100].[VCP_DB].dbo.UpsertTransaction_OINV @DocEntry = @list_of_cols_val_tab_del
					END
				ELSE IF DB_NAME() LIKE 'Z%VCP%' --Test
					BEGIN
						EXEC [192.168.100.100].[ZZZ_VCP_DB].dbo.UpsertTransaction_OINV @DocEntry = @list_of_cols_val_tab_del
					END
			END
	END