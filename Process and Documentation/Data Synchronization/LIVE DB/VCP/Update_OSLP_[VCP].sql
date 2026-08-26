-- Update OSLP [VCP_DB]

TRUNCATE TABLE
	VCP_DB.dbo.OSLP

INSERT INTO
    VCP_DB.dbo.OSLP
SELECT
    *
FROM
    (
		SELECT
			T0.SlpCode,
			T0.SlpName
		FROM
			[192.168.11.103].VCP.dbo.OSLP T0
		WHERE
			(
				T0.Active = 'Y'
				OR
				T0.SlpCode IN
				(
					SELECT
						A0.SlpCode
					FROM
						VCP_DB.dbo.RebateProgram A0
				)
			)

    ) T0