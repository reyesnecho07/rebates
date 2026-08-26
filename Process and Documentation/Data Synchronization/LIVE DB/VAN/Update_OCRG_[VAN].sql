-- Update OCRG [VAN_DB]

TRUNCATE TABLE
	VAN_DB.dbo.OCRG

INSERT INTO
    VAN_DB.dbo.OCRG
SELECT
    *
FROM
    (
		SELECT
			T0.GroupCode,
			T0.GroupName
		FROM
			[192.168.11.103].VAN.dbo.OCRG T0
			
    ) T0