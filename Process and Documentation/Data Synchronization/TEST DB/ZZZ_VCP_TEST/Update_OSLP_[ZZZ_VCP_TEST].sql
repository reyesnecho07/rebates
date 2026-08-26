-- Update OSLP [ZZZ_VCP_DB]

TRUNCATE TABLE
	ZZZ_VCP_DB.dbo.OSLP

INSERT INTO
    ZZZ_VCP_DB.dbo.OSLP
SELECT
    *
FROM
    (
		SELECT
			T0.SlpCode,
			T0.SlpName
		FROM
			[192.168.11.103].ZZZ_VCP_TEST.dbo.OSLP T0
		WHERE
			(
				T0.Active = 'Y'
				OR
				T0.SlpCode IN
				(
					SELECT
						A0.SlpCode
					FROM
						ZZZ_VCP_DB.dbo.RebateProgram A0
				)
			)

    ) T0