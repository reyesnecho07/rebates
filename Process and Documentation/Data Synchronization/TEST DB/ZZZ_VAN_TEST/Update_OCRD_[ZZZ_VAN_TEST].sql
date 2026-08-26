-- Update OCRD [ZZZ_VAN_DB]

TRUNCATE TABLE
    ZZZ_VAN_DB.dbo.OCRD

INSERT INTO
    ZZZ_VAN_DB.dbo.OCRD
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
			[192.168.11.103].ZZZ_VAN_TEST.dbo.OCRD T0
		WHERE
            T0.CardType = 'C'

    ) T0