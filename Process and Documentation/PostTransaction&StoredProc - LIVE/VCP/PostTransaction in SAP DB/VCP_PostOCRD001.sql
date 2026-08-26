/*====================================================================================================================================*/
-- PostOCRD001
-- PostOCRD001 - Post Business Partner Master - NGR - 04/30/2026
-- Setup: Rebate Setup
/*====================================================================================================================================*/
IF @object_type = '2' AND @transaction_type IN ('A', 'U')
	BEGIN
		IF EXISTS
		(
			SELECT
				1
			FROM
				OCRD T0
			WHERE
				T0.CardCode = @list_of_cols_val_tab_del
		)
			BEGIN
				IF DB_NAME() = 'VCP' --Live
					BEGIN
						EXEC [192.168.100.100].[VCP_DB].dbo.UpsertMaster_OCRD @CardCode = @list_of_cols_val_tab_del
					END
				ELSE IF DB_NAME() LIKE 'Z%VCP%' --Test
					BEGIN
						EXEC [192.168.100.100].[ZZZ_VCP_DB].dbo.UpsertMaster_OCRD @CardCode = @list_of_cols_val_tab_del
					END
			END
	END