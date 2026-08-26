-- Update OCRD [ZZZ_NEXCHEM_DB]

TRUNCATE TABLE
    ZZZ_NEXCHEM_DB.dbo.OCRD

INSERT INTO
    ZZZ_NEXCHEM_DB.dbo.OCRD
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
			[192.168.11.103].ZZZ_NEXCHEM_TEST.dbo.OCRD T0
		WHERE
            T0.CardType = 'C'

    ) T0