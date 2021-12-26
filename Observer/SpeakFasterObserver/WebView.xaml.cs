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
            string webViewUrl = Environment.GetEnvironmentVariable("SPEAKFASTER_WEBVIEW_URL");
            Debug.Assert(webViewUrl != null && webViewUrl != "");
            TheBrowser.Load(webViewUrl);
        }

    }
}
