-- Update OSLP [ZZZ_NEXCHEM_DB]

TRUNCATE TABLE
	ZZZ_NEXCHEM_DB.dbo.OSLP

INSERT INTO
    ZZZ_NEXCHEM_DB.dbo.OSLP
SELECT
    *
FROM
    (
		SELECT
			T0.SlpCode,
			T0.SlpName
		FROM
			[192.168.11.103].ZZZ_NEXCHEM_TEST.dbo.OSLP T0
		WHERE
			(
				T0.Active = 'Y'
				OR
				T0.SlpCode IN
				(
					SELECT
						A0.SlpCode
					FROM
						ZZZ_NEXCHEM_DB.dbo.RebateProgram A0
				)
			)

    ) T0