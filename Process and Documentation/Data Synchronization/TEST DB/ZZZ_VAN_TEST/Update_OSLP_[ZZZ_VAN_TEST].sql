-- Update OSLP [ZZZ_VAN_DB]

TRUNCATE TABLE
	ZZZ_VAN_DB.dbo.OSLP

INSERT INTO
    ZZZ_VAN_DB.dbo.OSLP
SELECT
    *
FROM
    (
		SELECT
			T0.SlpCode,
			T0.SlpName
		FROM
			[192.168.11.103].ZZZ_VAN_TEST.dbo.OSLP T0
		WHERE
			(
				T0.Active = 'Y'
				OR
				T0.SlpCode IN
				(
					SELECT
						A0.SlpCode
					FROM
						ZZZ_VAN_DB.dbo.RebateProgram A0
				)
			)

    ) T0