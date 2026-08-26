/*====================================================================================================================================*/
-- PostOITM001
-- PostOITM001 - Post Item Master - NGR - 04/30/2026
-- Setup: Rebate Setup
/*====================================================================================================================================*/
IF @object_type = '4' AND @transaction_type IN ('A', 'U')
	BEGIN
		IF EXISTS
		(
			SELECT
				1
			FROM
				OITM T0
			WHERE
				T0.ItemCode = @list_of_cols_val_tab_del
		)
			BEGIN
				IF DB_NAME() = 'VCP' --Live
					BEGIN
						EXEC [192.168.100.100].[VCP_DB].dbo.UpsertMaster_OITM @ItemCode = @list_of_cols_val_tab_del
					END
				ELSE IF DB_NAME() LIKE 'Z%VCP%' --Test
					BEGIN
						EXEC [192.168.100.100].[ZZZ_VCP_DB].dbo.UpsertMaster_OITM @ItemCode = @list_of_cols_val_tab_del
					END
			END
	END