import React, { useState, useMemo, useEffect } from 'react';
import {
    Box,
    Typography,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    TextField,
    Button,
    Alert,
    CircularProgress,
    SelectChangeEvent,
    ToggleButtonGroup,
    ToggleButton,
    FormLabel,
} from '@mui/material';
import { RideRequest, createRideRequest, CreateRideData } from '../../services/rideService';

interface CreateRideFormProps {
    onSuccess: (newRide: RideRequest) => void;
}

// Helper function to generate future time slots for a given date
const generateTimeSlots = (selectedDateStr: string): string[] => {
    const slots: string[] = [];
    if (!selectedDateStr) return slots;

    const now = new Date();
    const selectedDate = new Date(selectedDateStr);
    selectedDate.setHours(0, 0, 0, 0);

    const isToday = now.toDateString() === selectedDate.toDateString();
    let startHour = isToday ? now.getHours() : 0;

    let startMinute = 0;
    if (isToday) {
        const currentMinutes = now.getMinutes();
        if (currentMinutes < 30) {
            startMinute = 30;
        } else {
            startMinute = 0;
            startHour += 1;
        }
    }

    for (let hour = startHour; hour < 24; hour++) {
        for (let minute of [0, 30]) {
            if (hour === startHour && minute < startMinute) {
                continue;
            }
            const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
            slots.push(timeString);
        }
    }
    return slots;
};

const CreateRideForm: React.FC<CreateRideFormProps> = ({ onSuccess }) => {
    const [destination, setDestination] = useState<'Airport' | 'Train Station' | 'Bus Terminal' | null>(null);
    const [departureDateStr, setDepartureDateStr] = useState('');
    const [departureTimeSlot, setDepartureTimeSlot] = useState('');

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const availableTimeSlots = useMemo(() => generateTimeSlots(departureDateStr), [departureDateStr]);

    useEffect(() => {
        if (departureTimeSlot && !availableTimeSlots.includes(departureTimeSlot)) {
            setDepartureTimeSlot('');
        }
    }, [availableTimeSlots, departureTimeSlot]);

    const handleDestinationChange = (
        event: React.MouseEvent<HTMLElement>,
        newDestination: 'Airport' | 'Train Station' | 'Bus Terminal' | null,
    ) => {
        if (newDestination !== null) {
            setDestination(newDestination);
        }
    };

    const handleTimeSlotChange = (event: SelectChangeEvent<string>) => {
        setDepartureTimeSlot(event.target.value);
    };

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setError(null);

        if (!destination || !departureDateStr || !departureTimeSlot) {
            setError('Please select a destination, date, and time slot.');
            return;
        }

        const [year, month, day] = departureDateStr.split('-').map(Number);
        const [hours, minutes] = departureTimeSlot.split(':').map(Number);

        const departureDateTime = new Date(year, month - 1, day, hours, minutes);

        if (isNaN(departureDateTime.getTime())) {
            setError('Invalid date/time combination.');
            return;
        }

        const rideData: CreateRideData = {
            destination,
            departureTime: departureDateTime.toISOString(),
        };

        setIsLoading(true);
        try {
            const newRide = await createRideRequest(rideData);
            onSuccess(newRide);
        } catch (err: any) {
            console.error("Failed to create ride request:", err);
            setError(err.response?.data?.message || err.message || 'Failed to create ride request.');
        } finally {
            setIsLoading(false);
        }
    };

    const today = new Date().toISOString().split('T')[0];

    return (
        <Box
            component="form"
            onSubmit={handleSubmit}
            sx={{
                display: 'flex',
                flexDirection: 'column',
                gap: 3,
                p: 3,
                backgroundColor: 'background.paper',
                borderRadius: '12px',
                boxShadow: 10,
                border: 1,
                borderColor: 'divider',
                maxWidth: 'sm',
                mx: 'auto',
            }}
        >
            <Typography variant="h6" component="h2" gutterBottom color="primary">
                Find a Ride Companion
            </Typography>

            {error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}

            <FormControl component="fieldset" required disabled={isLoading}>
                <FormLabel component="legend" sx={{ mb: 1, fontWeight: 'medium' }}>Destination</FormLabel>
                <ToggleButtonGroup
                    value={destination}
                    exclusive
                    onChange={handleDestinationChange}
                    aria-label="Destination"
                    fullWidth
                    color="primary"
                >
                    <ToggleButton value="Airport" aria-label="Airport" sx={{ flexGrow: 1 }}>Airport</ToggleButton>
                    <ToggleButton value="Train Station" aria-label="Train Station" sx={{ flexGrow: 1 }}>Train Station</ToggleButton>
                    <ToggleButton value="Bus Terminal" aria-label="Bus Terminal" sx={{ flexGrow: 1 }}>Bus Terminal</ToggleButton>
                </ToggleButtonGroup>
            </FormControl>

            <TextField
                id="departureDate"
                label="Departure Date"
                type="date"
                fullWidth
                required
                disabled={isLoading}
                value={departureDateStr}
                onChange={(e) => setDepartureDateStr(e.target.value)}
                InputLabelProps={{
                    shrink: true,
                }}
                inputProps={{
                    min: today,
                }}
            />

            <FormControl fullWidth required disabled={isLoading || !departureDateStr}>
                <InputLabel id="time-slot-label">Departure Time</InputLabel>
                <Select
                    labelId="time-slot-label"
                    id="departureTimeSlot"
                    value={departureTimeSlot}
                    label="Departure Time"
                    onChange={handleTimeSlotChange}
                    MenuProps={{
                        PaperProps: {
                            style: {
                                maxHeight: 200,
                            },
                        },
                    }}
                >
                    {!departureDateStr && <MenuItem value="" disabled>Select a date first</MenuItem>}
                    {departureDateStr && availableTimeSlots.length === 0 && <MenuItem value="" disabled>No available slots today</MenuItem>}
                    {availableTimeSlots.map((slot) => (
                        <MenuItem key={slot} value={slot}>
                            {new Date(`1970-01-01T${slot}:00`).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                        </MenuItem>
                    ))}
                </Select>
            </FormControl>

            <Button
                type="submit"
                variant="contained"
                disabled={isLoading || !destination || !departureDateStr || !departureTimeSlot}
                size="large"
                sx={{
                    py: 1.5,
                    fontWeight: 'bold',
                }}
            >
                {isLoading ? <CircularProgress size={24} color="inherit" /> : 'Create Ride Request'}
            </Button>
        </Box>
    );
};

export default CreateRideForm;
