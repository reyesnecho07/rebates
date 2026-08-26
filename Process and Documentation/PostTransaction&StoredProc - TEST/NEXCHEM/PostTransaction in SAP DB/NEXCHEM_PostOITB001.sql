/*====================================================================================================================================*/
-- PostOITB001
-- PostOITB001 - Post Item Groups- NGR - 04/30/2026
-- Setup: Rebate Setup
/*====================================================================================================================================*/
IF @object_type = '52' AND @transaction_type IN ('A', 'U')
	BEGIN
		IF EXISTS
		(
			SELECT
				1
			FROM
				OITB T0
			WHERE
				T0.ItmsGrpCod = @list_of_cols_val_tab_del
		)
			BEGIN
				IF DB_NAME() = 'NEXCHEM' --Live
					BEGIN
						EXEC [192.168.100.100].[NEXCHEM_DB-LIVE].dbo.UpsertMaster_OITB @ItmsGrpCod = @list_of_cols_val_tab_del
					END
				ELSE IF DB_NAME() LIKE 'Z%NEXCHEM%' --Test
					BEGIN
						EXEC [192.168.100.100].[ZZZ_NEXCHEM_DB].dbo.UpsertMaster_OITB @ItmsGrpCod = @list_of_cols_val_tab_del
					END
			END
	END