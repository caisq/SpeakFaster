using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Text;
using System.Threading.Tasks;
using System.Windows;

namespace SpeakFasterObserver
{
    public partial class WebView : Window
    {
        public WebView()
        {
            InitializeComponent();
        }

        private void Window_Loaded(object sender, RoutedEventArgs e)
        {
            //CefSharp.Wpf.ChromiumWebBrowser browser = new();
            //mainGrid.Children.Add(browser);
            //CefSharp.WinForms.ChromiumWebBrowser browser = new();
        }

    }
}
