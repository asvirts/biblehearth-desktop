use tauri::{LogicalSize, PhysicalPosition, WebviewWindow};

const DEFAULT_WIDTH: f64 = 1600.0;
const DEFAULT_HEIGHT: f64 = 1060.0;
const SCREEN_MARGIN: f64 = 16.0;

fn fitted_dimension(preferred: f64, available: u32, frame: u32, scale: f64) -> f64 {
    let usable = available.saturating_sub(frame) as f64 / scale;
    preferred.min((usable - SCREEN_MARGIN * 2.0).max(1.0))
}

pub fn show_at_default_size(window: &WebviewWindow) -> tauri::Result<()> {
    let monitor = match window.current_monitor()? {
        Some(monitor) => Some(monitor),
        None => window.primary_monitor()?,
    };
    if let Some(monitor) = monitor {
        let area = monitor.work_area();
        let scale = monitor.scale_factor();
        let inner = window.inner_size()?;
        let outer = window.outer_size()?;
        let frame_width = outer.width.saturating_sub(inner.width);
        let frame_height = outer.height.saturating_sub(inner.height);
        let width = fitted_dimension(DEFAULT_WIDTH, area.size.width, frame_width, scale);
        let height = fitted_dimension(DEFAULT_HEIGHT, area.size.height, frame_height, scale);
        // A small display must also be allowed below the usual resize minimum.
        window.set_min_size(Some(LogicalSize::new(width.min(780.0), height.min(600.0))))?;
        window.set_size(LogicalSize::new(width, height))?;
        let outer_width = width * scale + f64::from(frame_width);
        let outer_height = height * scale + f64::from(frame_height);
        window.set_position(PhysicalPosition::new(
            area.position.x + ((f64::from(area.size.width) - outer_width) / 2.0).round() as i32,
            area.position.y + ((f64::from(area.size.height) - outer_height) / 2.0).round() as i32,
        ))?;
    }
    window.show()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn spacious_screen_uses_preferred_size() {
        assert_eq!(fitted_dimension(DEFAULT_WIDTH, 3440, 0, 1.0), 1600.0);
        assert_eq!(fitted_dimension(DEFAULT_HEIGHT, 1380, 28, 1.0), 1060.0);
    }

    #[test]
    fn smaller_screen_reserves_frame_and_margin() {
        assert_eq!(fitted_dimension(DEFAULT_WIDTH, 1366, 16, 1.0), 1318.0);
        assert_eq!(fitted_dimension(DEFAULT_HEIGHT, 728, 40, 1.0), 656.0);
        assert_eq!(fitted_dimension(DEFAULT_HEIGHT, 580, 40, 1.0), 508.0);
    }

    #[test]
    fn retina_screen_fits_in_logical_pixels() {
        assert_eq!(fitted_dimension(DEFAULT_WIDTH, 2880, 0, 2.0), 1408.0);
        assert_eq!(fitted_dimension(DEFAULT_HEIGHT, 1740, 56, 2.0), 810.0);
    }
}
