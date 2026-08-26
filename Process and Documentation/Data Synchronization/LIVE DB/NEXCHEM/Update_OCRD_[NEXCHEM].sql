-- Update OCRD [NEXCHEM_DB]

TRUNCATE TABLE
    NEXCHEM_DB.dbo.OCRD

INSERT INTO
    NEXCHEM_DB.dbo.OCRD
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
			[192.168.11.103].NEXCHEM.dbo.OCRD T0
		WHERE
            T0.CardType = 'C'

    ) T0