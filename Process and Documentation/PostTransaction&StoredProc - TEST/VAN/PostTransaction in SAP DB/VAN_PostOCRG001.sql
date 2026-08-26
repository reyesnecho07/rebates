/*====================================================================================================================================*/
-- PostOCRG001
-- PostOCRG001 - Post Card Groups - NGR - 04/30/2026
-- Setup: Rebate Setup
/*====================================================================================================================================*/
IF @object_type = '10' AND @transaction_type IN ('A', 'U')
	BEGIN
		IF EXISTS
		(
			SELECT
				1
			FROM
				OCRG T0
			WHERE
				T0.GroupCode = @list_of_cols_val_tab_del
		)
			BEGIN
				IF DB_NAME() = 'VAN' --Live
					BEGIN
						EXEC [192.168.100.100].[VAN_DB-LIVE].dbo.UpsertMaster_OCRG @GroupCode = @list_of_cols_val_tab_del
					END
				ELSE IF DB_NAME() LIKE 'Z%VAN%' --Test
					BEGIN
						EXEC [192.168.100.100].[ZZZ_VAN_DB].dbo.UpsertMaster_OCRG @GroupCode = @list_of_cols_val_tab_del
					END
			END
	END