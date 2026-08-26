-- Update OCRD [VAN_DB]

TRUNCATE TABLE
    VAN_DB.dbo.OCRD

INSERT INTO
    VAN_DB.dbo.OCRD
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
			[192.168.11.103].VAN.dbo.OCRD T0
		WHERE
            T0.CardType = 'C'

    ) T0