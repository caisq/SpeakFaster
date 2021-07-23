## Python environment

It is highly recommended that you do Python development in a virtualenv.

In install the required dependencies in the virtualenv, do:

```sh
python install -r requirements.txt
```

## Postprocessing

### Audio Event Classification

We use [YAMNet](https://tfhub.dev/google/lite-model/yamnet/tflite/1)
to extract audio event labels from input audio files.

Command line example:

```sh
python extract_audio_events.py testdata/test_audio_1.wav /tmp/audio_events.tsv
```

### Visual Object Detection

We use [SSD on MobileNetV2](https://tfhub.dev/tensorflow/ssd_mobilenet_v2/fpnlite_640x640/1) to detect visual objects in images captures from camera(s).

Command line example for an input video file (e.g., an .mp4 file):

```sh
python detect_objects.py \
    --input_video_path testdata/test_video_1.mp4 \
    --output_tsv_path /tmp/visual_objects.tsv
```

Command line example for a series of image files specified by a glob pattern:

```sh
python detect_objects.py \
    --input_image_glob 'testdata/pic*-standard-size.jpg' \
    --frame_rate 2 \
    --output_tsv_path /tmp/visual_objects.tsv
```

Note the test images in the testdata/ folder are under the CC0 (public domain)
license and are obtained from the URLs such as:
- https://search.creativecommons.org/photos/10590078-2f13-4caf-b96d-5d1db14eccd4
- https://search.creativecommons.org/photos/832045ea-53f3-4a3d-9c35-9b51f9add43d

## Automatic Speech Recognitino (ASR, Speech-to-text) on audio files

The SpeakFaster Observer writes audio data to .flac files that are approximately
60 second each in length. To transcribe a consecutive series of such .flac files,
find the path to the first .flac file in the series and feed it to the audio_asr.py
script. Additionally, provide path to the  output .tsv file. For example:

```sh
python audio_asr.py data/20210710T095258428-MicWaveIn.flac /tmp/speech_transcript.tsv
```

The script automatically finds consecutive audio files in the same directory as the
first audio file based on the length of each audio file and the timestamps in the
file names.

To perform ASR and speaker diarization at the same time, use the `--speaker_count`
argument. For example:

```sh
python audio_asr.py \
    --speaker_count=2 \
    data/20210710T095258428-MicWaveIn.flac /tmp/speech_transcript.tsv
```

The speaker count must be known beforehand. In the .tsv file, the `Content`
column with contain the speaker index (e.g., "Speaker 2") appended to the
transcripts.

# TOOD(cais): Add instructions for Google Cloud credentials.

## Running unit tests in this folder

Use:

```sh
./run_tests.sh
```