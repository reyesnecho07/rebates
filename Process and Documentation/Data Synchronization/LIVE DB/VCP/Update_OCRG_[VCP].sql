-- Update OCRG [VCP_DB]

TRUNCATE TABLE
	VCP_DB.dbo.OCRG

INSERT INTO
    VCP_DB.dbo.OCRG
SELECT
    *
FROM
    (
		SELECT
			T0.GroupCode,
			T0.GroupName
		FROM
			[192.168.11.103].VCP.dbo.OCRG T0
			
    ) T0