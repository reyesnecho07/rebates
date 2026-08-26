-- Update OCRD [VCP_DB]

TRUNCATE TABLE
    VCP_DB.dbo.OCRD

INSERT INTO
    VCP_DB.dbo.OCRD
SELECT
    *
FROM
    (
		SELECT
			T0.CardCode,
			T0.CardName,
			T0.GroupCode,
			T0.SlpCode
		FROM
			[192.168.11.103].VCP.dbo.OCRD T0
		WHERE
            T0.CardType = 'C'

    ) T0