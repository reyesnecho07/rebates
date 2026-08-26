/*====================================================================================================================================*/
-- PostOACT001
-- PostOACT001 - Post G/L Accounts - NGR - 04/30/2026
-- Setup: Rebate Setup
/*====================================================================================================================================*/
IF @object_type = '1' AND @transaction_type IN ('A', 'U')
	BEGIN
		IF EXISTS
		(
			SELECT
				1
			FROM
				OACT T0
			WHERE
				T0.AcctCode = @list_of_cols_val_tab_del
		)
			BEGIN
				IF DB_NAME() = 'VAN' --Live
					BEGIN
						EXEC [192.168.100.100].[VAN_DB-LIVE].dbo.UpsertMaster_OACT @AcctCode = @list_of_cols_val_tab_del
					END
				ELSE IF DB_NAME() LIKE 'Z%VAN%' --Test
					BEGIN
						EXEC [192.168.100.100].[ZZZ_VAN_DB].dbo.UpsertMaster_OACT @AcctCode = @list_of_cols_val_tab_del
					END
			END
	END