-- Update OSLP [VAN_DB]

TRUNCATE TABLE
	VAN_DB.dbo.OSLP

INSERT INTO
    VAN_DB.dbo.OSLP
SELECT
    *
FROM
    (
		SELECT
			T0.SlpCode,
			T0.SlpName
		FROM
			[192.168.11.103].VAN.dbo.OSLP T0
		WHERE
			(
				T0.Active = 'Y'
				OR
				T0.SlpCode IN
				(
					SELECT
						A0.SlpCode
					FROM
						VAN_DB.dbo.RebateProgram A0
				)
			)

    ) T0