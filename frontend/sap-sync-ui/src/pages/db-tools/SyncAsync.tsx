// src/pages/SyncAsync.tsx
import { Box, Typography } from '@mui/material';

export default function SyncAsync() {
  

  return (
    <>
    <Box sx={{ p: 2, maxWidth: 560 }}>
      <Typography variant="h6" sx={{ mb: 2 }}>Async Sync</Typography>
      <Typography variant="body1" color="text.secondary">
        Asynchronous sync functionality for SAP B1 to MSSQL data transfer. Typically used for long-running sync operations that are executed in the background, allowing users to continue using the application without waiting for the sync to complete. Users can monitor the progress and view results once the sync is finished. 
      </Typography>
      <Typography variant="body1" color="text.secondary"> 
        Typically IoT mesrements or large datasets that require more time to process are good candidates for asynchronous sync. This feature enhances user experience by providing flexibility and improving performance for data synchronization tasks.
      </Typography>
    </Box>
    </>
  );
}


