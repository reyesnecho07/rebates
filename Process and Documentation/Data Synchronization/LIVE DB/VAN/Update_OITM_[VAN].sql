-- Update OITM [VAN_DB]

TRUNCATE TABLE
	VAN_DB.dbo.OITM

INSERT INTO
    VAN_DB.dbo.OITM
SELECT
    *
FROM
    (
		SELECT
			T0.ItemCode,
			T0.ItemName,
			T0.ItmsGrpCod
		FROM
			[192.168.11.103].VAN.dbo.OITM T0
		WHERE
			(
				NOT
				(
					-- This is used for getting inactive Item, but it has 'NOT' in 'AND' so that it gets an active Item.
					(
						T0.validFor = 'N'
						AND T0.frozenFor = 'Y'
						AND T0.frozenTo > CAST(GETDATE() AS DATE)
						AND ISNULL(T0.frozenTo, '') <> ''
					)
					OR
					(
						T0.validFor = 'Y'
						AND T0.frozenFor = 'N'
						AND T0.validTo < CAST(GETDATE() AS DATE)
						AND ISNULL(T0.validTo, '') <> ''
					)
					OR
					(
						T0.validFor = 'N'
						AND T0.frozenFor = 'Y'
						AND ISNULL(T0.frozenTo, '') = ''
					)
				)
				OR
				T0.ItemCode IN
				(
					SELECT DISTINCT
						A1.ItemCode
					FROM
						VAN_DB.dbo.FixProdRebate A1

					UNION

					SELECT DISTINCT
						A2.ItemCode
					FROM
						VAN_DB.dbo.IncItemRebate A2

					UNION

					SELECT DISTINCT
						A3.ItemCode
					FROM
						VAN_DB.dbo.PerProdRebate A3
				)
			)
    ) T0