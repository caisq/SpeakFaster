using FlacBox;
using Google.Cloud.Speech.V1;
using NAudio.Wave;
using System;
using System.Diagnostics;
using System.IO;
using System.Threading.Tasks;

namespace SpeakFasterObserver
{
    class AudioInput
    {
        private static readonly int AUDIO_NUM_CHANNELS = 1;
        private static readonly int AUDIO_BITS_PER_SAMPLE = 16;
        private static readonly int AUDIO_SAMPLE_RATE_HZ = 16000;
        private static readonly float RECOG_PERIOD_SECONDS = 2.0f;

        private readonly string dataDir;
        private WaveIn waveIn = null;
        private string flacFilePath = null;
        private FileStream flacStream = null; 
        private FlacWriter flacWriter = null;
        private int[] buffer = null;
        private volatile bool isRecording = false;
        private static readonly object flacLock = new object();

        private SpeechClient speechClient;
        private SpeechClient.StreamingRecognizeStream recogStream;
        private BufferedWaveProvider recogBuffer;

        public AudioInput(string dataDir) {
            this.dataDir = dataDir;
        }

        /**
         * Start recording audio waveform from the built-in microphone.
         * 
         * Creates a new InProgress .flac file to save the data to.
         */
        public void StartRecordingFromMicrophone()
        {
            if (isRecording)
            {
                return;
            }
            speechClient = SpeechClient.Create();
            recogStream = speechClient.StreamingRecognize();
            // recogStream.WriteCompleteAsync();
            Debug.WriteLine($"recogStream = {recogStream}");
            recogStream.WriteAsync(new StreamingRecognizeRequest()
            {
                StreamingConfig = new StreamingRecognitionConfig()
                {
                    Config = new RecognitionConfig()
                    {
                        Encoding = RecognitionConfig.Types.AudioEncoding.Linear16,
                        AudioChannelCount = 1,
                        SampleRateHertz = AUDIO_SAMPLE_RATE_HZ,
                        LanguageCode = "en-US",
                    },
                    SingleUtterance = false,
                },
            });
            Task.Run(async () =>
            {
                string saidWhat = "";
                while (await recogStream.GetResponseStream().MoveNextAsync())
                {
                    foreach (var result in recogStream.GetResponseStream().Current.Results)
                    {
                        foreach (var alternative in result.Alternatives)
                        {
                            saidWhat = alternative.Transcript;
                            Debug.WriteLine($"Transcript: {saidWhat}");
                        }
                    }
                }
            });
            waveIn = new WaveIn
            {
                WaveFormat = new WaveFormat(AUDIO_SAMPLE_RATE_HZ, AUDIO_NUM_CHANNELS)
            };
            if (waveIn.WaveFormat.BitsPerSample != AUDIO_BITS_PER_SAMPLE)
            {
                // TODO(#64): Handle this exception add the app level.
                throw new NotSupportedException(
                    $"Expected wave-in bits per sample to be {AUDIO_BITS_PER_SAMPLE}, " +
                    $"but got {waveIn.WaveFormat.BitsPerSample}");
            }
            waveIn.DataAvailable += new EventHandler<WaveInEventArgs>(WaveDataAvailable);
            recogBuffer = new BufferedWaveProvider(waveIn.WaveFormat);
            waveIn.StartRecording();
            isRecording = true;
        }

        /**
         * Stops any ongoing recording from microphone.
         * 
         * If a current InProgress .flac exists. Rename it to make it final.
         */
        public void StopRecordingFromMicrophone()
        {
            if (!isRecording)
            {
                return;
            }
            waveIn.StopRecording();
            MaybeEndCurrentFlacWriter();
            isRecording = false;
        }

        private void WaveDataAvailable(object sender, WaveInEventArgs e)
        {
            recogBuffer.AddSamples(e.Buffer, 0, e.BytesRecorded);
            float bufferedSeconds = (float) recogBuffer.BufferedBytes / (AUDIO_BITS_PER_SAMPLE / 8) / AUDIO_SAMPLE_RATE_HZ;
            if (bufferedSeconds > RECOG_PERIOD_SECONDS)
            {
                byte[] frameBuffer = new byte[recogBuffer.BufferedBytes];
                int numBytes = recogBuffer.BufferedBytes;
                recogBuffer.Read(frameBuffer, 0, numBytes);
                try
                {
                    recogStream.WriteAsync(new StreamingRecognizeRequest()
                    {
                        AudioContent = Google.Protobuf.ByteString.CopyFrom(frameBuffer, 0, numBytes)
                    });
                } 
                catch (Exception ex)
                {
                    Debug.WriteLine($"Streaming recog exception: {ex.Message}");
                }
                recogBuffer.ClearBuffer();
            }

            lock (flacLock)
            {
                if (buffer == null || buffer.Length != e.Buffer.Length / 2)
                {
                    // Reuse the buffer whenever we can.
                    buffer = new int[e.Buffer.Length / 2];
                }
                for (int i = 0; i < e.Buffer.Length; i += 2)
                {
                    buffer[i / 2] = BitConverter.ToInt16(e.Buffer, i);
                }
                MaybeCreateFlacWriter();
                flacWriter.WriteSamples(buffer);
            }
        }

        /**
         * Marks the current InProgress .flac file final and starts a new
         * InProgress .flac file.
         */
        public void RotateFlacWriter()
        {
            MaybeEndCurrentFlacWriter();
        }

        /**
         * If a FlacWriter object currently exists, stops it and removes the
         * InProgress suffix from its file name.
         */
        private void MaybeEndCurrentFlacWriter()
        {
            lock (flacLock)
            {
                if (flacWriter == null)
                {
                    return;
                }
                flacWriter.EndStream();
                flacStream.Close();
                File.Move(
                    flacFilePath,
                    FileNaming.removeInProgressSuffix(flacFilePath));
                flacFilePath = null;
                flacStream = null;
                flacWriter = null;
            }
        }

        /** Creates a FlacWriter object if none currently exists. */
        private void MaybeCreateFlacWriter()
        {
            if (flacWriter != null)
            {
                return;
            }
            flacFilePath = flacFilePath = FileNaming.addInProgressSuffix(
                    FileNaming.getMicWavInFilePath(dataDir));
            flacStream = File.Create(flacFilePath);
            flacWriter = new FlacWriter(flacStream);
            FlacStreaminfo streamInfo = new()
            {
                ChannelsCount = AUDIO_NUM_CHANNELS,
                BitsPerSample = AUDIO_BITS_PER_SAMPLE,
                SampleRate = AUDIO_SAMPLE_RATE_HZ,
                MaxBlockSize = AUDIO_SAMPLE_RATE_HZ,
            };
            flacWriter.StartStream(streamInfo);
        }
    }
}
