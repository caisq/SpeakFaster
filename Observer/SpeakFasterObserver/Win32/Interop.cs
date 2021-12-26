using System;
using System.Runtime.InteropServices;
using System.Text;

namespace SpeakFasterObserver.Win32
{
    public partial class Interop
    {
        public const int DWMWA_EXTENDED_FRAME_BOUNDS = 9;

        public delegate IntPtr WindowsHookDelegate(int nCode, IntPtr wParam, IntPtr lParam);

        [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
        public static extern IntPtr SetWindowsHookEx(int idHook, WindowsHookDelegate lpfn, IntPtr hMod, uint dwThreadId);

        [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
        [return: MarshalAs(UnmanagedType.Bool)]
        public static extern bool UnhookWindowsHookEx(IntPtr hhk);

        [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
        public static extern IntPtr CallNextHookEx(IntPtr hhk, int nCode, IntPtr wParam, IntPtr lParam);

        [DllImport("kernel32.dll", CharSet = CharSet.Auto, SetLastError = true)]
        public static extern IntPtr GetModuleHandle(string lpModuleName);

        [DllImport("gdi32.dll")]
        public static extern bool BitBlt(IntPtr hdcDest, int nxDest, int nyDest, int nWidth, int nHeight, IntPtr hdcSrc, int nXSrc, int nYSrc, RasterOperation dwRop);

        [DllImport("gdi32.dll")]
        public static extern IntPtr CreateCompatibleBitmap(IntPtr hdc, int nWidth, int nHeight);

        [DllImport("gdi32.dll")]
        public static extern IntPtr CreateCompatibleDC(IntPtr hdc);

        [DllImport("gdi32.dll")]
        public static extern IntPtr DeleteDC(IntPtr hdc);

        [DllImport("gdi32.dll")]
        public static extern IntPtr DeleteObject(IntPtr hObject);

        [DllImport("dwmapi.dll")]
        public static extern int DwmGetWindowAttribute(IntPtr hwnd, int dwAttribute, out RECT pvAttribute, int cbAttribute);

        [DllImport("user32.dll")]
        public static extern IntPtr GetDesktopWindow();

        [DllImport("user32.dll")]
        public static extern IntPtr GetForegroundWindow();

        [DllImport("user32.dll")]
        public static extern IntPtr GetWindowDC(IntPtr hWnd);

        [DllImport("user32.dll", SetLastError = true)]
        public static extern bool GetWindowRect(IntPtr hwnd, out RECT lpRect);

        [DllImport("user32.dll")]
        public static extern bool ReleaseDC(IntPtr hWnd, IntPtr hDc);

        [DllImport("gdi32.dll")]
        public static extern IntPtr SelectObject(IntPtr hdc, IntPtr hObject);

        [DllImport("user32.dll")]
        public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);

        [DllImport("gdi32.dll")]
        public static extern int GetDIBits([In] IntPtr hdc, [In] IntPtr hbmp, uint uStartScan, uint cScanLines, [Out] byte[] lpvBits, ref BITMAPINFO lpbi, DIB_Color_Mode uUsage);

        // Tobii Stream Engine interop begins.
        //public const string stream_engine_dll = "tobii_stream_engine";

        //// TODO(cais): Confirm. Do not submit.
        //[DllImport(stream_engine_dll, CallingConvention = CallingConvention.Cdecl, CharSet = CharSet.Ansi, EntryPoint = "tobii_get_device_name")]
        //private static extern tobii_error_t tobii_get_device_name(IntPtr device, StringBuilder device_name);
    }

    // Data types related to Tobii Stream Engine.
    //public enum tobii_error_t
    //{
    //    TOBII_ERROR_NO_ERROR,
    //    TOBII_ERROR_INTERNAL,
    //    TOBII_ERROR_INSUFFICIENT_LICENSE,
    //    TOBII_ERROR_NOT_SUPPORTED,
    //    TOBII_ERROR_NOT_AVAILABLE,
    //    TOBII_ERROR_CONNECTION_FAILED,
    //    TOBII_ERROR_TIMED_OUT,
    //    TOBII_ERROR_ALLOCATION_FAILED,
    //    TOBII_ERROR_INVALID_PARAMETER,
    //    TOBII_ERROR_CALIBRATION_ALREADY_STARTED,
    //    TOBII_ERROR_CALIBRATION_NOT_STARTED,
    //    TOBII_ERROR_ALREADY_SUBSCRIBED,
    //    TOBII_ERROR_NOT_SUBSCRIBED,
    //    TOBII_ERROR_OPERATION_FAILED,
    //    TOBII_ERROR_CONFLICTING_API_INSTANCES,
    //    TOBII_ERROR_CALIBRATION_BUSY,
    //    TOBII_ERROR_CALLBACK_IN_PROGRESS,
    //    TOBII_ERROR_TOO_MANY_SUBSCRIBERS,
    //    TOBII_ERROR_CONNECTION_FAILED_DRIVER,
    //    TOBII_ERROR_UNAUTHORIZED
    //}
}
